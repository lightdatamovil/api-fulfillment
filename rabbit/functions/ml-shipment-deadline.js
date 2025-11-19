// utils/ml-shipment-deadline.js

// Si tu runtime no tiene fetch nativo, instalá node-fetch:
// import fetch from "node-fetch";

async function meliGet(url, token) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`ML GET ${url} -> ${res.status}`);
    return res.json();
}

/**
 * Obtiene el deadline REAL del envío, con soporte para:
 * - ME1 (estimated_delivery_time raíz)
 * - ME2
 * - FULL (shipping_option.estimated_delivery_time)
 * - estimated_delivery_limit
 * - estimated_delivery_final
 * - estimated_delivery_extended
 */
export async function getOrderDeliveryDeadline(mlOrder, token) {
    const shippingId = mlOrder?.shipping?.id;
    if (!shippingId) return null;

    const url = `https://api.mercadolibre.com/shipments/${shippingId}`;
    const data = await meliGet(url, token);

    // 1) Caso normal (ME1 / ME2)
    let etd = data?.estimated_delivery_time;
    if (etd?.date) {
        return normalizeDeadline(etd, "root");
    }

    // 2) Caso FULL (viene dentro de shipping_option)
    let etdFull = data?.shipping_option?.estimated_delivery_time;
    if (etdFull?.date) {
        return normalizeDeadline(etdFull, "shipping_option");
    }

    // 3) Caso "delivery_limit"
    let limit = data?.shipping_option?.estimated_delivery_limit?.date;
    if (limit) {
        return {
            type: "limit",
            date: limit,
            source: "estimated_delivery_limit"
        };
    }

    // 4) Caso "delivery_final"
    let finalDate = data?.shipping_option?.estimated_delivery_final?.date;
    if (finalDate) {
        return {
            type: "final",
            date: finalDate,
            source: "estimated_delivery_final"
        };
    }

    // 5) Caso "extended"
    let extended = data?.shipping_option?.estimated_delivery_extended?.date;
    if (extended) {
        return {
            type: "extended",
            date: extended,
            source: "estimated_delivery_extended"
        };
    }

    // Si ningún deadline existe → null
    return null;
}

function normalizeDeadline(etd, source = "root") {
    return {
        type: etd?.type || null,
        date: etd?.date || null,
        pay_before: etd?.pay_before || null,
        offset: etd?.offset || null,
        promise: etd?.promise || null,
        raw: etd,
        source
    };
}
