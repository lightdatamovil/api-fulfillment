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

import { createPedido } from "../functions/createPedido.js";
import { getPedidoDidByNumber } from "../functions/getDidPedidoByNumber.js";
import { updatePedidoStatusWithHistory } from "../functions/updatePedidoStatusWithHistory.js";
import { mapTNToPedidoPayload } from "../functions/mapTNToPedidoPayload.js";


const USER_AGENT = "API Lightdata (administracion@lightdata.com.ar)";
const TOKEN_REGISTRY_URL = "https://cuentasarg.lightdata.com.ar/getTokenTNAll.php";


const http = axios.create({
    timeout: 15000,
    headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
    },
});


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

        // 5) Mapear payload a tu modelo de tablas
        const payload = mapTNToPedidoPayload(orderTN, sellerData);
        console.log(JSON.stringify(payload, null, 2));

        // 6) Idempotencia por (seller_id, number)
        const number = String(payload.number);
        const keyCache = `${sellerData.seller_id}_${number}`;
        let did =
            ORDENES_CACHE[keyCache]?.did || (await getPedidoDidByNumber(db, number));
        const isNew = !did;

        // (Transacciones removidas)

        if (isNew) {
            did = await createPedido(db, payload, sellerData?.quien ?? null);
            ORDENES_CACHE[keyCache] = { did };
            ESTADOS_CACHE[did] = payload.status;

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

                return {
                    ok: true,
                    status_updated: did,
                    number,
                    seller_id: sellerData.seller_id,
                };
            } else {
                return { ok: true, noop: did, number, seller_id: sellerData.seller_id };
            }
        }
    } catch (e) {
        logRed(e);
        // (Rollback eliminado)
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
        console.log("[TN] arrancando main…]");
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
