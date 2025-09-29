// worker_pedidos_consumer.js (ESM)
// Ejecuta: node worker_pedidos_consumer.js

import amqp from "amqplib";
import { createClient as createRedisClient } from "redis";
import axios from "axios";
import mysql from "mysql2/promise";
import { executeQuery } from "lightdata-tools";

const RABBITMQ_URL = "amqp://lightdata:QQyfVBKRbw6fBb@158.69.131.226:5672";

// ---------- Redis ----------
const redisClient = createRedisClient({
  socket: { host: "192.99.190.137", port: 50301 },
  password: "sdJmdxXC8luknTrqmHceJS48NTyzExQg",
});
redisClient.on("error", (err) => console.error("Redis error:", err));

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
async function obtenerDatosEnvioML(resource, token) {
  try {
    const url = `https://api.mercadolibre.com${resource}`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data?.id ? data : null;
  } catch (e) {
    console.error("ML fetch error:", e?.message || e);
    return null;
  }
}

// ---------- Cache simple ----------
const ORDENES_CACHE = Object.create(null); // { `${seller_id}_${number}`: { did } }
const ESTADOS_CACHE = Object.create(null); // { did: status }
setInterval(() => {
  for (const k of Object.keys(ESTADOS_CACHE)) delete ESTADOS_CACHE[k];
}, 1000 * 60 * 60 * 24 * 14);

// ---------- Queries básicas ----------
async function getPedidoDidByNumber(db, number) {
  const rows = await executeQuery(
    db,
    `SELECT did FROM pedidos WHERE number = ? AND elim = 0 ORDER BY autofecha DESC LIMIT 1`,
    [number]
  );
  return rows?.length ? Number(rows[0].did) : 0;
}
async function getStatusVigente(db, did) {
  if (ESTADOS_CACHE[did]) return ESTADOS_CACHE[did];
  const rows = await executeQuery(
    db,
    `SELECT status FROM pedidos WHERE did = ? AND superado = 0 AND elim = 0 LIMIT 1`,
    [did]
  );
  const s = rows?.length ? rows[0].status : null;
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
async function createPedido(db, payload, userId) {
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

  // Items
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

  // Historial inicial
  await executeQuery(
    db,
    `INSERT INTO pedidos_historial (did_pedido, estado, quien, superado, elim) VALUES (?, ?, ?, 0, 0)`,
    [did, payload.status || "created", userId ?? null],
    true
  );

  return did;
}

// ---------- UPDATE status in-place + historial versionado ----------
async function updatePedidoStatusWithHistory(db, did, newStatus, userId, fecha = new Date(), alsoInsertItemsPayload = null) {
  // UPDATE in-place del status
  await executeQuery(
    db,
    `UPDATE pedidos SET status = ?, quien = ? WHERE did = ? AND superado = 0 AND elim = 0`,
    [newStatus, userId ?? null, did],
    true
  );

  // (Opcional) insertar items también en cambio de estado (como tu script viejo)
  if (alsoInsertItemsPayload && Array.isArray(alsoInsertItemsPayload.items)) {
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

  // Historial versionado (supera vigente e inserta nuevo)
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
}

// ---------- Proceso por mensaje ----------
async function processOrderMessage(rawMsg) {
  const datain = JSON.parse(rawMsg);
  const seller_id = String(datain.sellerid);
  const resource = datain.resource;

  // Filtro de sellers permitidos
  const sellersPermitidos = ["298477234", "452306476", "23598767", "746339074"];
  if (!sellersPermitidos.includes(seller_id)) {
    return { ok: true, skipped: "seller-no-permitido" };
  }
  console.log("Mensaje recibido:", { seller_id, resource });

  const token = await getTokenForSeller(seller_id);
  if (!token) return { ok: false, error: "token-not-found" };

  const sellerData = await getSellerData(seller_id);
  if (!sellerData) return { ok: false, error: "seller-data-not-found" };

  const db = await getConnectionLocal(sellerData.idempresa);

  try {
    const mlOrder = await obtenerDatosEnvioML(resource, token);
    if (!mlOrder) return { ok: false, error: "ml-order-null" };

    const number = String(mlOrder.id);
    const keyCache = `${seller_id}_${number}`;
    const payload = mapMlToPedidoPayload(mlOrder, sellerData);

    // ¿Existe?
    let did = ORDENES_CACHE[keyCache]?.did || (await getPedidoDidByNumber(db, number));
    const isNew = !did;

    if (isNew) {
      did = await createPedido(db, payload, sellerData?.quien ?? null);
      ORDENES_CACHE[keyCache] = { did };
      ESTADOS_CACHE[did] = payload.status;
      return { ok: true, created: did };
    } else {
      const prevStatus = await getStatusVigente(db, did);
      const hasStatusChange = prevStatus !== payload.status;

      if (hasStatusChange) {
        await updatePedidoStatusWithHistory(
          db,
          did,
          payload.status,
          sellerData?.quien ?? null,
          new Date(),
          payload // insertar items también en cambio de estado (como tu script antiguo)
        );
        ESTADOS_CACHE[did] = payload.status;
        ORDENES_CACHE[keyCache] = { did };
        return { ok: true, status_updated: did };
      } else {
        return { ok: true, noop: did };
      }
    }
  } finally {
    try { await db.end(); } catch { }
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
      if (channel) try { await channel.close(); } catch { }
      if (connection) try { await connection.close(); } catch { }

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
            console.error("Error procesando mensaje:", e);

            channel.nack(msg, false, false); // descartamos para evitar loops
          }
        },
        { noAck: false }
      );

      connection.on("close", () => {
        console.warn("⚠️ Conexión cerrada. Reintentando en 1s...");
        isConnecting = false;
        setTimeout(connect, 1000);
      });

      isConnecting = false;
    } catch (error) {
      console.error(`❌ Error al conectar canal ${channelName}:`, error);
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
    await listenToChannel("ordenesFF");
  } catch (e) {
    console.error("Error en main:", e);
  } finally {
    try { await redisClient.disconnect(); }
    catch {

    }
  }
})();
