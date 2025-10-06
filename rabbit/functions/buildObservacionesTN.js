export function buildObservacionesTN(order) {
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