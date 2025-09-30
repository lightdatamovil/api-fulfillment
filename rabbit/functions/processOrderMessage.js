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

export async function processOrderMessage(rawMsg) {
    let db;

    try {
        let datain;
        try {
            datain = JSON.parse(rawMsg);
        } catch (e) {
            logRed(e);
            return { ok: false, error: "json-parse" };
        }

        const seller_id = String(datain.sellerid);
        const resource = datain.resource;

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


        const cfg = getFFProductionDbConfig(
            String(sellerData.idempresa),
            hostFulFillement,
            portFulFillement
        );
        const db = await connectMySQL(cfg);

        const mlOrder = await obtenerDatosEnvioML(resource, token,);
        if (!mlOrder) {
            return { ok: false, error: "ml-order-null" };
        }

        const number = String(mlOrder.id);
        const keyCache = `${seller_id}_${number}`;
        const payload = mapMlToPedidoPayload(mlOrder, sellerData);

        let did = ORDENES_CACHE[keyCache]?.did || (await getPedidoDidByNumber(db, number,));
        const isNew = !did;

        if (isNew) {
            did = await createPedido(db, payload, sellerData?.quien ?? null,);
            ORDENES_CACHE[keyCache] = { did };
            ESTADOS_CACHE[did] = payload.status;
            return { ok: true, created: did };
        } else {
            const prevStatus = await getStatusVigente(db, did,);
            const hasStatusChange = prevStatus !== payload.status;

            if (hasStatusChange) {
                await updatePedidoStatusWithHistory(
                    db,
                    did,
                    payload.status,
                    sellerData?.quien ?? null,
                    new Date(),
                    payload,

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
    } finally {
        await db?.end();
    }
}