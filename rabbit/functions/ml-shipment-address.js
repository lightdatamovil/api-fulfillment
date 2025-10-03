// utils/ml-shipment-address.js

// si tu runtime no tiene fetch nativo, instalá node-fetch y reemplazá por:
// import fetch from "node-fetch";

async function meliGet(url, token) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`ML GET ${url} -> ${res.status}`);
    return res.json();
}

/**
 * Devuelve un objeto dirección normalizado (o null si no hay)
 * shape pensado para ser fácil de mapear a cualquier tabla luego.
 */
export async function getOrderReceiverAddress(mlOrder, token) {
    // si ya viene la dirección en la orden, úsala
    const rxInOrder = mlOrder?.shipping?.receiver_address;
    if (rxInOrder) {
        return normalizeRx(rxInOrder);
    }

    // si no, necesitamos el shipment.id para consultarlo
    const shippingId = mlOrder?.shipping?.id;
    if (!shippingId) return null;

    const url = `https://api.mercadolibre.com/shipments/${shippingId}`;
    const data = await meliGet(url, token);

    const rx =
        data?.receiver_address ||
        data?.destination?.receiver_address ||
        null;

    return rx ? normalizeRx(rx) : null;
}

function normalizeRx(rx) {
    const s = (v) => (v == null ? null : String(v).trim());
    const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    // address_line si no viene, la armamos con calle + número
    const streetName = s(rx.street_name ?? null);
    const streetNumber = s(rx.street_number ?? rx.number ?? null);
    const addressLine =
        s(rx.address_line ?? null) ||
        [streetName, streetNumber].filter(Boolean).join(" ") ||
        null;

    return {
        address_line: addressLine,
        calle: streetName,
        numero: streetNumber,
        cp: s(rx.zip_code ?? rx.zip ?? null),
        ciudad: s(rx.city?.name ?? rx.city?.id ?? null),
        provincia: s(rx.state?.name ?? rx.state?.id ?? null),
        pais: s(rx.country?.name ?? rx.country?.id ?? null),
        latitud: num(rx.latitude),
        longitud: num(rx.longitude),
        comentario: s(rx.comment ?? null),
    };
}
