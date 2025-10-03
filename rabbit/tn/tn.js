// tn.js  (Node.js ESM)
// Ejecuta: node tn.js
// Luego adaptar para que el "mensaje" venga de una cola y llamar processTNMessage(msg)

import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

import {
    connectMySQL,
    getFFProductionDbConfig,
    executeQuery,
    logRed,
} from "lightdata-tools";

import {
    ESTADOS_CACHE,
    ORDENES_CACHE,
    hostFulFillement,
    portFulFillement,
} from "../db.js";

// Reusamos tus funciones existentes (las de ML), no cambies su firma.
import { createPedido } from "../functions/createPedido.js";
import { getPedidoDidByNumber } from "../functions/getDidPedidoByNumber.js";
import { updatePedidoStatusWithHistory } from "../functions/updatePedidoStatusWithHistory.js";

// =============== CONFIG ===============

// Header exigido por TN (igual que tu PHP)
const USER_AGENT = "API Lightdata (administracion@lightdata.com.ar)";

// URL para obtener tokens TN (mapa enorme por empresa/cuenta/cliente)
const TOKEN_REGISTRY_URL =
    "https://cuentasarg.lightdata.com.ar/getTokenTNAll.php";

// Cliente axios con defaults
const http = axios.create({
    timeout: 15000,
    headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
    },
});

// =============== HELPERS ===============

// Formatea fecha de hoy a yyyymmdd en la TZ de Buenos Aires
function hoyYYYYMMDD() {
    const now = new Date();
    const y = new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
    }).format(now);
    const m = new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        month: "2-digit",
    }).format(now);
    const d = new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit",
    }).format(now);
    return `${y}${m}${d}`;
}

// Trae TODO el árbol de tokens TN y encuentra el token para un store_id
async function getTNTokenForStore(storeId) {
    const tk = hoyYYYYMMDD(); // token = fecha de hoy en yyyymmdd
    const url = `${TOKEN_REGISTRY_URL}?tk=${tk}`;
    try {
        const { data: json } = await http.get(url);
        // json es un árbol { empresa: { cuenta: { cliente: { seller_id, token }}}}
        const needle = String(storeId);
        for (const empKey of Object.keys(json)) {
            const cuentas = json[empKey];
            for (const ctaKey of Object.keys(cuentas)) {
                const clientes = cuentas[ctaKey];
                for (const cliKey of Object.keys(clientes)) {
                    const data = clientes[cliKey];
                    const sellerId = String(data.seller_id || "");
                    if (sellerId === needle) {
                        return {
                            token: String(data.token || ""),
                            seller_id: sellerId,
                            idempresa: Number(empKey),
                            did_cuenta: Number(empKey), // ajustá si tu mapeo real difiere
                            // si necesitás didCliente/didCuenta reales, podés guardarlos de cliKey/ctaKey
                        };
                    }
                }
            }
        }
        return null; // no encontrado
    } catch (err) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        throw new Error(
            `getTokenTNAll http ${status ?? "ERR"}: ${String(
                typeof body === "string" ? body : JSON.stringify(body)
            ).slice(0, 200)}`
        );
    }
}

// Trae la orden de TN
async function obtenerOrdenTN(storeId, orderId, token) {
    const url = `https://api.tiendanube.com/v1/${storeId}/orders/${orderId}`;
    try {
        const { data } = await http.get(url, {
            headers: { Authentication: `bearer ${token}` },
        });
        return data;
    } catch (err) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        throw new Error(
            `TN ${status ?? "ERR"} ${url} :: ${String(
                typeof body === "string" ? body : JSON.stringify(body)
            ).slice(0, 200)}`
        );
    }
}

// Arma observaciones “amistosas” como hacía tu PHP
function buildObservacionesTN(order) {
    const arr = [];
    if (order?.note && String(order.note).trim())
        arr.push(`Nota comprador: ${order.note}`);
    if (order?.owner_note && String(order.owner_note).trim())
        arr.push(`Nota vendedor: ${order.owner_note}`);

    // Si querés sumar Items:
    // const items = (order.products||[]).map(i => `${i.name} x${i.quantity}`).join(" | ");
    // if (items) arr.push(`Items: ${items}`);

    return arr.join(" ");
}

// Mapea JSON TN -> payload compatible con createPedido / tablas pedidos*
function mapTNToPedidoPayload(orderTN, sellerDataLike) {
    const didCuenta = Number(
        sellerDataLike?.did_cuenta ?? sellerDataLike?.idempresa ?? 0
    );
    const sellerId = String(
        sellerDataLike?.seller_id ?? orderTN?.store_id ?? ""
    );

    // Dirección y comprador
    const shipping = orderTN?.shipping_address || {};
    const buyerId = orderTN?.customer?.id ?? "";
    const buyerName = shipping?.name ?? orderTN?.customer?.name ?? "";

    // Fecha venta (TN viene UTC)
    const fechaVenta = orderTN?.created_at
        ? new Date(orderTN.created_at)
        : new Date();

    // Totales
    const totalAmount = Number(orderTN?.total ?? 0);

    // Items TN
    const itemsTN = Array.isArray(orderTN?.products) ? orderTN.products : [];
    const items = itemsTN.map((p) => {
        const mlItemIdFinal = String(p?.id ?? "");
        const fallbackSku = p?.sku ? String(p.sku) : mlItemIdFinal || "";

        // Normalizar imagen: string URL o null (TN puede mandar objeto)
        let imgUrl = null;
        if (p?.image) {
            if (typeof p.image === "string") {
                imgUrl = p.image;
            } else if (typeof p.image === "object") {
                imgUrl = p.image.src || p.image.url || null;
            }
        }

        return {
            seller_sku: String(p?.sku ?? ""),                // NOT NULL
            codigo: String(p?.sku ?? mlItemIdFinal ?? ""),   // NOT NULL
            descripcion: String(p?.name ?? ""),              // NOT NULL
            ml_id: String(mlItemIdFinal ?? ""),              // NOT NULL
            dimensions: "",                                  // NOT NULL (TN no trae aquí)
            variacion: p?.variant_id ? String(p.variant_id) : "", // NOT NULL
            id_variacion: p?.variant_id ?? null,
            user_product_id: String(p?.id ?? fallbackSku ?? ""),  // NOT NULL
            cantidad: Number(p?.quantity ?? 1),
            variation_attributes: null,                      // (si querés, stringify desde variant opts)
            imagen: imgUrl,                                  // <-- string o null (NO objeto)
        };
    });

    // Estado
    const status = String(orderTN?.payment_status ?? orderTN?.status ?? "created");

    // Envío: si no hay, dejar ""
    const envioId =
        orderTN?.shipping_tracking_number || orderTN?.shipping_option_code || "";

    return {
        did_cuenta: didCuenta,
        status,
        number: String(orderTN?.id ?? orderTN?.number ?? ""),
        fecha_venta: fechaVenta,
        buyer_id: String(buyerId ?? ""),
        buyer_nickname: "",
        buyer_name: String(buyerName ?? ""),
        buyer_last_name: "",
        total_amount: totalAmount,
        ml_shipment_id: String(envioId ?? ""),
        ml_id: String(orderTN?.id ?? ""), // NOT NULL en tu código/DDL
        ml_pack_id: "", // TN no maneja pack; queda vacío
        observaciones: buildObservacionesTN(orderTN),
        armado: 0,
        descargado: 0,
        quien_armado: 0,
        quien: Number(sellerDataLike?.quien ?? 0),
        items,
        seller_id: sellerId, // por si tu createPedido lo toma para pedidos.seller_id
    };
}

// Si necesitás derivar “empresa/cuenta” para la conexión de FF.
// Por ahora usamos lo que trae getTNTokenForStore() para idempresa/did_cuenta.
async function getSellerDataByStore(storeId) {
    console.log("[TN] Resolviendo token para store_id", storeId);

    const tokenInfo = await getTNTokenForStore(storeId);
    if (!tokenInfo) return null;
    return {
        idempresa: tokenInfo.idempresa,
        did_cuenta: tokenInfo.did_cuenta,
        quien: 0,
        seller_id: tokenInfo.seller_id,
        tn_token: tokenInfo.token,
    };
}

// =============== CORE ===============

// Procesa un mensaje TN “crudo” {store_id, event, id}
// - trae token
// - baja orden TN
// - conecta DB empresa
// - inserta/actualiza pedidos + productos + historial (transacción)
export async function processTNMessage(rawMsg) {
    // 1) Parsear
    let msg;
    try {
        msg = typeof rawMsg === "string" ? JSON.parse(rawMsg) : rawMsg;
    } catch {
        return { ok: false, error: "invalid-json" };
    }
    const storeId = Number(msg?.store_id);
    const orderId = Number(msg?.id);
    if (!storeId || !orderId) return { ok: false, error: "invalid-fields" };

    // 2) Resolver sellerData + token
    const sellerData = await getSellerDataByStore(storeId);
    if (!sellerData?.tn_token) return { ok: false, error: "tn-token-not-found" };

    // 3) Obtener orden completa desde TN
    const orderTN = await obtenerOrdenTN(storeId, orderId, sellerData.tn_token);

    // 4) Conectar DB FulFillement de esa empresa/cuenta
    const cfg = getFFProductionDbConfig(
        String(sellerData.idempresa ?? sellerData.did_cuenta),
        hostFulFillement,
        portFulFillement
    );

    let db;
    try {
        db = await connectMySQL(cfg);
        console.log(orderTN, sellerData);

        // 5) Mapear payload a tu modelo de tablas
        const payload = mapTNToPedidoPayload(orderTN, sellerData);

        // 6) Idempotencia por (seller_id, number)
        const number = String(payload.number);
        const keyCache = `${sellerData.seller_id}_${number}`;
        let did =
            ORDENES_CACHE[keyCache]?.did || (await getPedidoDidByNumber(db, number));
        const isNew = !did;

        await executeQuery(db, "START TRANSACTION");

        if (isNew) {
            did = await createPedido(db, payload, sellerData?.quien ?? null);
            ORDENES_CACHE[keyCache] = { did };
            ESTADOS_CACHE[did] = payload.status;

            await executeQuery(db, "COMMIT");
            return { ok: true, created: did, number, seller_id: sellerData.seller_id };
        } else {
            // Estado vigente actual vs nuevo
            const [prev] = await executeQuery(
                db,
                "SELECT status FROM pedidos WHERE did = ? LIMIT 1",
                [did],
                true
            );
            const prevStatus = prev?.status ?? null;

            if (prevStatus !== payload.status) {
                await updatePedidoStatusWithHistory(
                    db,
                    did,
                    payload.status,
                    sellerData?.quien ?? null,
                    new Date(),
                    payload
                );
                ESTADOS_CACHE[did] = payload.status;
                ORDENES_CACHE[keyCache] = { did };

                await executeQuery(db, "COMMIT");
                return {
                    ok: true,
                    status_updated: did,
                    number,
                    seller_id: sellerData.seller_id,
                };
            } else {
                await executeQuery(db, "COMMIT");
                return { ok: true, noop: did, number, seller_id: sellerData.seller_id };
            }
        }
    } catch (e) {
        logRed(e);
        try {
            await executeQuery(db, "ROLLBACK");
        } catch { }
        return { ok: false, error: "exception", message: String(e?.message ?? e) };
    } finally {
        await db?.end();
    }
}

// =============== MAIN DE PRUEBA COMPATIBLE WINDOWS ===============
// Ejecuta el main solo si este archivo fue invocado directamente.
const thisFile = path.resolve(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (thisFile === invoked) {
    (async () => {
        console.log("[TN] arrancando main…");
        // Simula “llega un mensaje del sistema/cola”
        const demoMsg = {
            store_id: 47586,
            event: "order/created",
            id: 1798832816,
        };

        const r = await processTNMessage(demoMsg);
        console.log("[TN] resultado:", r);
        process.exit(0);
    })().catch((e) => {
        console.error("[TN] error:", e);
        process.exit(1);
    });
}
