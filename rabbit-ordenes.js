// worker_pedidos_consumer.js (ESM)
// Ejecuta: node worker_pedidos_consumer.js

import amqp from "amqplib";
import { createClient as createRedisClient } from "redis";
import axios from "axios";
import mysql from "mysql2/promise";
import { executeQuery } from "lightdata-tools";
import { getFFProductionDbConfig } from "lightdata-tools";
import { hostFulFillement, portFulFillement } from "./db.js";
export async function openEmpresaConnection(idempresa) {
  if (typeof idempresa !== "string" && typeof idempresa !== "number") {
    throw new Error(`idempresa debe ser string|number, es: ${typeof idempresa}`);
  }

  // Mismo origen de verdad que en buildHandlerWrapper
  const cfg = getFFProductionDbConfig(
    String(idempresa),
    hostFulFillement,
    portFulFillement
  );
  // cfg esperado: { host, port, user, password, database }

  // Conexión “short lived”: abrir → usar → cerrar
  const conn = await mysql.createConnection({
    ...cfg,
    multipleStatements: true,
    connectTimeout: 10000,       // para que no cuelgue
    enableKeepAlive: true,
    keepAliveInitialDelay: 5000,
  });
  console.log("[db:conn:opened]", { idempresa });

  return conn;
}

const RABBITMQ_URL = "amqp://lightdata:QQyfVBKRbw6fBb@158.69.131.226:5672";

// ---------- Redis ----------
const redisClient = createRedisClient({
  socket: { host: "192.99.190.137", port: 50301 },
  password: "sdJmdxXC8luknTrqmHceJS48NTyzExQg",
});
redisClient.on("error", (err) =>
  console.error("[redis:error]", { err: err?.message || err })
);

// ---------- Conexión DB por empresa ----------
async function getConnectionLocal(idempresa) {
  if (typeof idempresa !== "string" && typeof idempresa !== "number") {
    throw new Error(`idempresa debe ser string|number, es: ${typeof idempresa}`);
  }
  const baseCfg = {
    host: "149.56.182.49",
    port: 44347,
    user: `ue${idempresa}`,
    password: `78451296_${idempresa}`,
  };
  const dbName = `empresa_${idempresa}`;

  const serverConn = await mysql.createConnection(baseCfg);
  await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await serverConn.end();

  const dbConn = await mysql.createConnection({
    ...baseCfg,
    database: dbName,
    multipleStatements: true,
  });
  return dbConn;
}

// ---------- Redis getters ----------
async function getTokenForSeller(seller_id) {
  if (!redisClient.isOpen) await redisClient.connect();
  const token = await redisClient.hGet("token", String(seller_id));
  return token || null;
}
async function getSellerData(seller_id) {
  if (!redisClient.isOpen) await redisClient.connect();
  const raw = await redisClient.hGet("seller_ff_data", String(seller_id));
  return raw ? JSON.parse(raw) : null;
}

// ---------- ML fetch ----------
async function obtenerDatosEnvioML(resource, token, corrId) {
  try {
    const url = `https://api.mercadolibre.com${resource}`;
    console.log("[ml:fetch:start]", { corrId, url });
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    console.log("[ml:fetch:ok]", { corrId, hasId: !!data?.id });
    return data?.id ? data : null;
  } catch (e) {
    console.error("[ml:fetch:error]", {
      corrId,
      err: e?.message || e,
    });
    return null;
  }
}

// ---------- Cache simple ----------
const ORDENES_CACHE = Object.create(null); // { `${seller_id}_${number}`: { did } }
const ESTADOS_CACHE = Object.create(null); // { did: status }
setInterval(() => {
  for (const k of Object.keys(ESTADOS_CACHE)) delete ESTADOS_CACHE[k];
  console.log("[cache:estados:cleared]");
}, 1000 * 60 * 60 * 24 * 14);

// ---------- Queries básicas ----------
async function getPedidoDidByNumber(db, number, corrId) {
  const rows = await executeQuery(
    db,
    `SELECT did FROM pedidos WHERE number = ? AND elim = 0 ORDER BY autofecha DESC LIMIT 1`,
    [number]
  );
  const did = rows?.length ? Number(rows[0].did) : 0;
  console.log("[db:pedido:byNumber]", { corrId, number, did });
  return did;
}
async function getStatusVigente(db, did, corrId) {
  if (ESTADOS_CACHE[did]) {
    console.log("[cache:status:hit]", { corrId, did, status: ESTADOS_CACHE[did] });
    return ESTADOS_CACHE[did];
  }
  const rows = await executeQuery(
    db,
    `SELECT status FROM pedidos WHERE did = ? AND superado = 0 AND elim = 0 LIMIT 1`,
    [did]
  );
  const s = rows?.length ? rows[0].status : null;
  console.log("[db:pedido:status]", { corrId, did, status: s });
  if (s != null) ESTADOS_CACHE[did] = s;
  return s;
}

// ---------- Mapper ML → payload pedido ----------
function mapMlToPedidoPayload(ml, sellerData) {
  const firstItem = ml?.order_items?.[0];
  const variation_attributes = firstItem?.item?.variation_attributes || null;

  return {
    did_cuenta: sellerData?.idcuenta ?? 0,
    status: ml?.status || "created",
    number: String(ml?.id || ""),
    fecha_venta: ml?.date_closed || new Date().toISOString(),
    buyer_id: ml?.buyer?.id ? String(ml.buyer.id) : "",
    buyer_nickname: ml?.buyer?.nickname ?? "",
    buyer_name: ml?.buyer?.first_name ?? "",
    buyer_last_name: ml?.buyer?.last_name ?? "",
    total_amount: ml?.total_amount ?? 0,
    ml_shipment_id: ml?.shipping?.id ? String(ml.shipping.id) : "",
    ml_id: ml?.id ? String(ml.id) : "",
    ml_pack_id: ml?.pack_id ? String(ml.pack_id) : "",
    site_id: ml?.site_id || "",
    currency_id: ml?.currency_id || "",
    observaciones: "",
    armado: 0,
    descargado: 0,
    quien_armado: 0,
    items: [
      {
        seller_sku: firstItem?.item?.seller_sku ?? "",
        codigo: firstItem?.item?.id ? String(firstItem.item.id) : null,
        descripcion: firstItem?.item?.title ?? "",
        cantidad: Number(firstItem?.quantity || 1),
        variation_attributes,
        id_variacion: firstItem?.item?.variation_id ?? null,
        user_product_id: firstItem?.item?.user_product_id ?? null,
        ml_id: firstItem?.id ? String(firstItem.id) : null,
        dimensions: firstItem?.item?.dimensions || "",
        variacion: null,
        imagen: null,
      },
    ],
  };
}

// ---------- CREATE pedido ----------
async function createPedido(db, payload, userId, corrId) {
  try {
    console.log("[pedido:create:start]", { corrId, number: payload?.number });
    const cols = [
      "did_cuenta", "status", "number", "fecha_venta", "buyer_id", "buyer_nickname",
      "buyer_name", "buyer_last_name", "total_amount", "ml_shipment_id", "ml_id",
      "ml_pack_id", "site_id", "currency_id", "observaciones", "armado", "descargado",
      "quien_armado", "quien", "superado", "elim"
    ];
    const ph = cols.map(() => "?");
    const vals = [
      payload.did_cuenta, payload.status, payload.number, payload.fecha_venta,
      payload.buyer_id, payload.buyer_nickname, payload.buyer_name, payload.buyer_last_name,
      payload.total_amount, payload.ml_shipment_id, payload.ml_id, payload.ml_pack_id,
      payload.site_id, payload.currency_id, payload.observaciones ?? "",
      payload.armado ?? 0, payload.descargado ?? 0, payload.quien_armado ?? 0,
      userId ?? null, 0, 0
    ];
    const ins = await executeQuery(
      db,
      `INSERT INTO pedidos (${cols.join(",")}) VALUES (${ph.join(",")})`,
      vals,
      true
    );
    if (!ins?.insertId) throw new Error("No se pudo insertar pedido");
    const id = ins.insertId;
    await executeQuery(db, `UPDATE pedidos SET did = ? WHERE id = ?`, [id, id], true);
    const did = id;

    console.log("[pedido:create:items:start]", { corrId, did, items: (payload.items || []).length });
    for (const it of (payload.items || [])) {
      if (!it || Number(it.cantidad) <= 0) continue;
      const icol = [
        "did_pedido", "seller_sku", "codigo", "descripcion", "ml_id", "dimensions",
        "variacion", "id_variacion", "user_product_id", "cantidad", "variation_attributes",
        "imagen", "quien", "superado", "elim"
      ];
      const iph = icol.map(() => "?");
      const ival = [
        did, it.seller_sku ?? "", it.codigo ?? null, it.descripcion ?? null, it.ml_id ?? null,
        it.dimensions ?? null, it.variacion ?? null, it.id_variacion ?? null,
        it.user_product_id ?? null, Number(it.cantidad),
        it.variation_attributes ? JSON.stringify(it.variation_attributes) : null,
        it.imagen ?? null, userId ?? null, 0, 0
      ];
      await executeQuery(
        db,
        `INSERT INTO pedidos_productos (${icol.join(",")}) VALUES (${iph.join(",")})`,
        ival,
        true
      );
    }

    await executeQuery(
      db,
      `INSERT INTO pedidos_historial (did_pedido, estado, quien, superado, elim) VALUES (?, ?, ?, 0, 0)`,
      [did, payload.status || "created", userId ?? null],
      true
    );

    console.log("[pedido:create:ok]", { corrId, did, number: payload.number });
    return did;
  } catch (e) {
    console.error("[pedido:create:error]", {
      corrId,
      number: payload?.number,
      err: e?.message || e,
      stack: e?.stack,
    });
    throw e;
  }
}

// ---------- UPDATE status in-place + historial versionado ----------
async function updatePedidoStatusWithHistory(db, did, newStatus, userId, fecha = new Date(), alsoInsertItemsPayload = null, corrId) {
  try {
    console.log("[pedido:status:update:start]", { corrId, did, to: newStatus });
    await executeQuery(
      db,
      `UPDATE pedidos SET status = ?, quien = ? WHERE did = ? AND superado = 0 AND elim = 0`,
      [newStatus, userId ?? null, did],
      true
    );

    if (alsoInsertItemsPayload && Array.isArray(alsoInsertItemsPayload.items)) {
      console.log("[pedido:status:update:items:start]", { corrId, did, items: alsoInsertItemsPayload.items.length });
      for (const it of alsoInsertItemsPayload.items) {
        if (!it || Number(it.cantidad) <= 0) continue;
        const icol = [
          "did_pedido", "seller_sku", "codigo", "descripcion", "ml_id", "dimensions",
          "variacion", "id_variacion", "user_product_id", "cantidad", "variation_attributes",
          "imagen", "quien", "superado", "elim"
        ];
        const iph = icol.map(() => "?");
        const ival = [
          did, it.seller_sku ?? "", it.codigo ?? null, it.descripcion ?? null, it.ml_id ?? null,
          it.dimensions ?? null, it.variacion ?? null, it.id_variacion ?? null,
          it.user_product_id ?? null, Number(it.cantidad),
          it.variation_attributes ? JSON.stringify(it.variation_attributes) : null,
          it.imagen ?? null, userId ?? null, 0, 0
        ];
        await executeQuery(
          db,
          `INSERT INTO pedidos_productos (${icol.join(",")}) VALUES (${iph.join(",")})`,
          ival,
          true
        );
      }
    }

    await executeQuery(
      db,
      `UPDATE pedidos_historial SET superado = 1 WHERE did_pedido = ? AND superado = 0 AND elim = 0`,
      [did],
      true
    );
    const insH = await executeQuery(
      db,
      `INSERT INTO pedidos_historial (did, did_pedido, estado, fecha, quien, superado, elim)
       VALUES (0, ?, ?, ?, ?, 0, 0)`,
      [did, newStatus, fecha, userId ?? null],
      true
    );
    const idh = insH?.insertId;
    if (idh) {
      await executeQuery(db, `UPDATE pedidos_historial SET did = ? WHERE id = ?`, [idh, idh], true);
    }

    console.log("[pedido:status:update:ok]", { corrId, did, to: newStatus });
  } catch (e) {
    console.error("[pedido:status:update:error]", {
      corrId,
      did,
      to: newStatus,
      err: e?.message || e,
      stack: e?.stack,
    });
    throw e;
  }
}

// ---------- Proceso por mensaje ----------
async function processOrderMessage(rawMsg) {
  const t0 = Date.now();
  let corrId = "unknown";
  let db;

  try {
    let datain;
    try {
      datain = JSON.parse(rawMsg);
    } catch (e) {
      console.error("[msg:parse:error]", { err: e?.message || e, raw: String(rawMsg).slice(0, 800) });
      return { ok: false, error: "json-parse" };
    }

    const seller_id = String(datain.sellerid);
    const resource = datain.resource;
    corrId = `${seller_id}|${resource}`;
    // console.log("[msg:received]", { corrId });

    const sellersPermitidos = ["298477234", "452306476", "23598767", "746339074"];
    if (!sellersPermitidos.includes(seller_id)) {
      // console.warn("[pedidos:skip:seller-no-permitido]", { corrId });
      return { ok: true, skipped: "seller-no-permitido" };
    }

    const token = await getTokenForSeller(seller_id);
    if (!token) {
      console.warn("[pedidos:skip:token-not-found]", { corrId });
      return { ok: false, error: "token-not-found" };
    }
    console.log("[token:ok]", { token });

    const sellerData = await getSellerData(seller_id);
    if (!sellerData) {
      console.warn("[pedidos:skip:seller-data-not-found]", { corrId });
      return { ok: false, error: "seller-data-not-found" };
    }
    console.log("[sellerData:ok]", { corrId, idempresa: sellerData.idempresa });



    db = await openEmpresaConnection(sellerData.idempresa);
    console.log("[db:connected]", { corrId });

    const mlOrder = await obtenerDatosEnvioML(resource, token, corrId);
    if (!mlOrder) {
      console.log("[ml:order:not-found]", { corrId, resource });

      console.warn("[pedidos:skip:ml-order-null]", { corrId });
      return { ok: false, error: "ml-order-null" };
    }

    const number = String(mlOrder.id);
    const keyCache = `${seller_id}_${number}`;
    const payload = mapMlToPedidoPayload(mlOrder, sellerData);

    let did = ORDENES_CACHE[keyCache]?.did || (await getPedidoDidByNumber(db, number, corrId));
    const isNew = !did;
    console.log("[pedido:existence]", { corrId, number, isNew, did });

    if (isNew) {
      did = await createPedido(db, payload, sellerData?.quien ?? null, corrId);
      ORDENES_CACHE[keyCache] = { did };
      ESTADOS_CACHE[did] = payload.status;
      console.log("[pedidos:created]", { corrId, did, ms: Date.now() - t0 });
      return { ok: true, created: did };
    } else {
      const prevStatus = await getStatusVigente(db, did, corrId);
      const hasStatusChange = prevStatus !== payload.status;
      console.log("[pedido:status:compare]", { corrId, did, prevStatus, newStatus: payload.status, hasStatusChange });

      if (hasStatusChange) {
        await updatePedidoStatusWithHistory(
          db,
          did,
          payload.status,
          sellerData?.quien ?? null,
          new Date(),
          payload,
          corrId
        );
        ESTADOS_CACHE[did] = payload.status;
        ORDENES_CACHE[keyCache] = { did };
        console.log("[pedidos:status_updated]", { corrId, did, ms: Date.now() - t0 });
        return { ok: true, status_updated: did };
      } else {
        console.warn("[pedidos:noop:status-igual]", { corrId, did, status: prevStatus });
        return { ok: true, noop: did };
      }
    }
  } catch (e) {
    console.error("[pedidos:process:error]", {
      corrId,
      err: e?.message || e,
      stack: e?.stack,
    });
    throw e;
  } finally {
    try { await db?.end(); } catch (e) {
      //    console.warn("[db:close:warn]", { corrId, err: e?.message || e });
    }
  }
}

// ---------- Listener RabbitMQ ----------
async function listenToChannel(channelName) {
  let connection = null;
  let channel = null;
  let isConnecting = false;

  const connect = async () => {
    if (isConnecting) return;
    isConnecting = true;

    try {
      if (channel) try { await channel.close(); } catch (e) {
        console.warn("[amqp:channel:close:warn]", { err: e?.message || e });
      }
      if (connection) try { await connection.close(); } catch (e) {
        console.warn("[amqp:conn:close:warn]", { err: e?.message || e });
      }

      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertQueue(channelName, { durable: true });

      console.log(`✅ Escuchando mensajes en: ${channelName}`);

      channel.consume(
        channelName,
        async (msg) => {
          if (!msg) return;
          try {
            await processOrderMessage(msg.content.toString());
            channel.ack(msg);
          } catch (e) {
            console.error("[consume:error]", {
              err: e?.message || e,
              stack: e?.stack,
              msg: msg.content?.toString?.()?.slice(0, 800),
            });
            // descartamos para evitar loops; si querés DLQ, cambiá el requeue y manejalo aparte
            channel.nack(msg, false, false);
          }
        },
        { noAck: false }
      );

      connection.on("close", () => {
        console.warn("[amqp:conn:close]", { note: "Reintentando en 1s..." });
        isConnecting = false;
        setTimeout(connect, 1000);
      });

      isConnecting = false;
    } catch (error) {
      console.error("[amqp:connect:error]", { err: error?.message || error });
      isConnecting = false;
      setTimeout(connect, 1000);
    }
  };

  await connect();
}

// ---------- main ----------
(async function main() {
  try {
    await redisClient.connect();
    console.log("[redis:connected]");
    await listenToChannel("ordenesFF");
  } catch (e) {
    console.error("[main:error]", { err: e?.message || e, stack: e?.stack });
  } finally {
    try { await redisClient.disconnect(); console.log("[redis:disconnected]"); }
    catch (e) { console.warn("[redis:disconnect:warn]", { err: e?.message || e }); }
  }
})();
