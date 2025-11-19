// utils/ml-shipment-deadline.js

// Si tu runtime no tiene fetch nativo, instalá node-fetch:
// import fetch from "node-fetch";

async function meliGet(url, token) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`ML GET ${url} -> ${res.status}`);
    return res.json();
}

/**
 * Devuelve un objeto normalizado con el deadline de entrega de ML.
 *
 * Ejemplo de salida:
 * {
 *   type: "known",
 *   date: "2025-11-23T23:59:59Z",
 *   promise: { ... },
 *   offset: { ... }
 * }
 *
 * Si no hay deadline, devuelve null.
 */
export async function getOrderDeliveryDeadline(mlOrder, token) {
    const shippingId = mlOrder?.shipping?.id;
    if (!shippingId) return null;

    const url = `https://api.mercadolibre.com/shipments/${shippingId}`;
    const data = await meliGet(url, token);

    const etd = data?.estimated_delivery_time;
    if (!etd) return null;

    return normalizeDeadline(etd);
}

function normalizeDeadline(etd) {
    return {
        type: etd?.type || null,
        date: etd?.date || null,
        promise: etd?.promise || null,
        offset: etd?.offset || null,
    };
}
