// Normaliza shipping_address de TN -> receiver_address esperado por createPedido
export function normalizeTNReceiverAddress(orderTN) {
  const a = orderTN?.shipping_address || {};
  const s = (v) => (v == null ? null : String(v).trim());
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const street_name = s(a?.street || a?.address || a?.address_line);
  const street_number = s(a?.number || a?.street_number);
  const address_line =
    s(a?.address_line) ||
    [street_name, street_number].filter(Boolean).join(" ") ||
    s(a?.address) ||
    null;

  // mapeos pedidos: zip_code -> cp, city -> localidad, state -> provincia, country -> pais
  const zip_code = s(a?.zip || a?.zipcode || a?.postal_code);
  const city = s(a?.city);
  const state = s(a?.province || a?.state);
  const country = s(a?.country);

  const latitude = num(a?.latitude);
  const longitude = num(a?.longitude);

  const comment = s(a?.comment || orderTN?.note || orderTN?.owner_note || null);

  return {
    address_line,
    street_name,
    street_number,
    zip_code,
    city,
    state,
    country,
    latitude,
    longitude,
    comment,
  };
}
