import axios from "axios"; // ⬅️ usamos axios

import { connectMySQL, getFFProductionDbConfig, logRed } from "lightdata-tools";
import { obtenerDatosEnvioML } from "./obtenerDatosEnvioML.js";
import { mapMlToPedidoPayload } from "./mapMLToPedidoPayload.js";
import { getPedidoDidByNumber } from "./getDidPedidoByNumber.js";
import { createPedido } from "./createPedido.js";
import { getSellerData } from "./getSellerData.js";
import { ESTADOS_CACHE, hostFulFillement, ORDENES_CACHE, portFulFillement } from "../db.js";
import { getTokenBySeller } from "./getTokenBySeller.js";
import { getStatusVigente } from "./getStatusVigente.js";
import { updatePedidoStatusWithHistory } from "./updatePedidoStatusWithHistory.js";
import { obtenerClienteCuenta } from "./obtenerCliente.js";
import { tryLockOrder } from "./redisDedupe.js";

/* ============== Axios client para ML ============== */
function mlClient(token) {
    return axios.create({
        baseURL: "https://api.mercadolibre.com",
        timeout: 10_000,
        headers: { Authorization: `Bearer ${token}` },
    });
}

async function fetchShipmentReceiverAddress(shippingId, token) {
    if (!shippingId) return null;
    const client = mlClient(token);

    const { data } = await client.get(`/shipments/${shippingId}`);
    // En algunos casos viene en receiver_address, otros en destination.receiver_address
    const rx = data?.receiver_address || data?.destination?.receiver_address || null;
    if (!rx) return null;
    console.log("rx", rx);

    const s = (v) => (v == null ? null : String(v).trim());
    const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const street_name = s(rx.street_name);
    const street_number = s(rx.street_number ?? rx.number);
    const address_line = s(rx.address_line) || [street_name, street_number].filter(Boolean).join(" ") || null;

    return {
        address_line,
        street_name,
        street_number,
        zip_code: s(rx.zip_code ?? rx.zip),
        city: s(rx.city?.name ?? rx.city?.id),
        state: s(rx.state?.name ?? rx.state?.id),
        country: s(rx.country?.name ?? rx.country?.id),
        latitude: num(rx.latitude),
        longitude: num(rx.longitude),
        comment: s(rx.comment),
    };
}
/* ================================================ */

export async function processOrderMessage(rawMsg) {
    let db;

    try {
        // Parse
        let datain;
        try {
            datain = JSON.parse(rawMsg);
        } catch (e) {
            logRed(e);
            return { ok: false, error: "json-parse" };
        }

        const seller_id = String(datain.sellerid);
        const resource = datain.resource;
        const orderNumber = resource.split("/").pop();
        const lockAcquired = await tryLockOrder(seller_id, orderNumber);

        if (!lockAcquired) {
            console.log("DUPLICADO DETECTADO. Ignorando:", seller_id, orderNumber);
            return { ok: true, skipped: "duplicado" };
        }

        console.log("resource", resource);


        const sellersPermitidos = ["298477234", "452306476", "23598767", "746339074"];
        if (!sellersPermitidos.includes(seller_id)) {
            return { ok: true, skipped: "seller-no-permitido" };
        }

        const token = await getTokenBySeller(seller_id);
        if (!token) {
            return { ok: false, error: "token-not-found" };
        }

        const sellerData = await getSellerData(seller_id);
        if (!sellerData) {
            return { ok: false, error: "seller-data-not-found" };
        }





        const cfg = getFFProductionDbConfig({
            host: hostFulFillement,
            port: portFulFillement,
            companyId: sellerData.idempresa
        });

        db = await connectMySQL(cfg);

        const cuentas = await obtenerClienteCuenta(db, seller_id);

        // Traer orden ML
        const mlOrder = await obtenerDatosEnvioML(resource, token);
        if (!mlOrder) {
            return { ok: false, error: "ml-order-null" };
        }
        console.log(mlOrder, "mlOrder");

        // 👉 Completar dirección desde shipments si falta
        if (!mlOrder?.shipping?.receiver_address && mlOrder?.shipping?.id) {
            try {
                const rx = await fetchShipmentReceiverAddress(mlOrder.shipping.id, token);
                if (rx) {
                    mlOrder.shipping = { ...(mlOrder.shipping || {}), receiver_address: rx };
                    console.log("[shipment-address]", rx);
                } else {
                    console.warn("[shipment-address] vacío para shipping.id:", mlOrder.shipping.id);
                }
            } catch (e) {
                console.warn("No se pudo obtener receiver_address del shipment:", e?.message || e);
            }
        }

        // Map a payload (incluye shipping.receiver_address si lo obtuvimos)
        const number = String(mlOrder.id);
        const keyCache = `${seller_id}_${number}`;
        const payload = mapMlToPedidoPayload(mlOrder, sellerData, cuentas.didCliente);

        // Alta / update
        let did =
            ORDENES_CACHE[keyCache]?.did ||
            (await getPedidoDidByNumber(db, number));
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
                    payload
                );
                ESTADOS_CACHE[did] = payload.status;
                ORDENES_CACHE[keyCache] = { did };
                return { ok: true, status_updated: did };
            } else {
                return { ok: true, noop: did };
            }
        }
    } catch (e) {
        logRed(e);
        return { ok: false, error: e?.message || "unknown" };
    } finally {
        await db?.end();
    }
}
