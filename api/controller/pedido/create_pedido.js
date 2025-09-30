// controller/pedidos/create_pedido.js
import { CustomException, executeQuery, Status, isDefined, isNonEmpty } from "lightdata-tools";

// Alias body -> columna real
const PEDIDOS_FIELD_MAP = {
    shipment_id: "ml_shipment_id",
    pack_id: "ml_pack_id",
    order_id: "ml_id",
    total: "total_amount",
    buyer_fullname: null,
};

const ALLOWED_PEDIDOS = [
    "status", "number", "fecha_venta",
    "ml_shipment_id", "ml_pack_id", "ml_id", "site_id", "currency_id",
    "buyer_id", "buyer_nickname", "buyer_name", "buyer_last_name", "buyer_email",
    "total_amount", "subtotal", "shipping_cost", "discount_amount",
    "armado", "descargado", "quien_armado", "seller_id", "observaciones",
    "receiver_name", "receiver_phone", "address_line", "city", "state", "zip_code",
];

const ALLOWED_ITEM_FIELDS = [
    "did_producto", "did_producto_valor", "id_variacion",
    "codigo", "imagen", "descripcion", "ml_id", "dimensions", "variacion", "seller_sku",
    "user_product_id",
    "cantidad",
    "variation_attributes",
];

export async function createPedido(db, req) {
    const { userId } = req.user ?? {};
    const body = req.body || {};

    // -------- Requeridos base (SIN did)
    const did_cuenta = Number(body.did_cuenta);
    if (!Number.isFinite(did_cuenta) || did_cuenta <= 0) {
        throw new CustomException({ title: "Parámetro inválido", message: "'did_cuenta' debe ser numérico > 0", status: Status.badRequest });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
        throw new CustomException({ title: "Items requeridos", message: "Debés enviar 'items' con al menos un ítem", status: Status.badRequest });
    }

    // -------- Defaults mínimos (NOT NULL típicos)
    if (!isDefined(body.status)) body.status = "created";
    if (!isDefined(body.number)) body.number = "";
    if (!isDefined(body.fecha_venta)) body.fecha_venta = new Date().toISOString();

    if (!isDefined(body.observaciones)) body.observaciones = "";
    if (!isDefined(body.armado)) body.armado = 0;
    if (!isDefined(body.descargado)) body.descargado = 0;
    if (!isDefined(body.quien_armado)) body.quien_armado = 0;

    if (!isDefined(body.ml_shipment_id) && isDefined(body.shipment_id)) body.ml_shipment_id = body.shipment_id;
    if (!isDefined(body.ml_pack_id) && isDefined(body.pack_id)) body.ml_pack_id = body.pack_id;
    if (!isDefined(body.ml_id) && isDefined(body.order_id)) body.ml_id = body.order_id;

    if (!isDefined(body.ml_shipment_id)) body.ml_shipment_id = "";
    if (!isDefined(body.ml_id)) body.ml_id = "";
    if (!isDefined(body.ml_pack_id)) body.ml_pack_id = "";

    if (!isDefined(body.buyer_id)) body.buyer_id = "";
    if (!isDefined(body.seller_id)) body.seller_id = "";

    // (Opcional) partir buyer_fullname
    if (isNonEmpty(body.buyer_fullname) && !body.buyer_name && !body.buyer_last_name) {
        const parts = String(body.buyer_fullname).trim().split(/\s+/);
        body.buyer_name = parts.shift() || "";
        body.buyer_last_name = parts.join(" ");
    }

    // -------- INSERT dinámico en pedidos (sin did)
    const cols = ["did_cuenta", "quien", "superado", "elim"];
    const vals = [did_cuenta, userId ?? null, 0, 0];
    const phs = ["?", "?", "?", "?"];

    for (const [kRaw, v] of Object.entries(body)) {
        if (!isDefined(v) || kRaw === "items") continue;
        const mapped = Object.prototype.hasOwnProperty.call(PEDIDOS_FIELD_MAP, kRaw)
            ? PEDIDOS_FIELD_MAP[kRaw]
            : kRaw;
        if (!mapped) continue;
        if (!ALLOWED_PEDIDOS.includes(mapped)) continue;
        cols.push(mapped); vals.push(v); phs.push("?");
    }

    const estadoInicial = isNonEmpty(body.status) ? String(body.status) : "created";

    const insSql = `INSERT INTO pedidos (${cols.join(",")}) VALUES (${phs.join(",")})`;
    const ins = await executeQuery(db, insSql, vals, true);
    if (!ins || ins.affectedRows === 0) {
        throw new CustomException({ title: "Error", message: "No se pudo crear el pedido", status: Status.internalServerError });
    }

    // did = id
    const id = ins.insertId;
    await executeQuery(db, `UPDATE pedidos SET did = ? WHERE id = ?`, [id, id], true);
    const did = id;

    // -------- INSERT items
    let insertedItems = 0;
    for (let i = 0; i < body.items.length; i++) {
        const it = body.items[i] || {};

        const cantidad = Number(it.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new CustomException({ title: "Cantidad inválida", message: `items[${i}].cantidad debe ser > 0`, status: Status.badRequest });
        }

        const itemCols = ["did_pedido", "quien", "superado", "elim"];
        const itemVals = [did, userId ?? null, 0, 0];
        const itemPhs = ["?", "?", "?", "?"];

        let tieneAnclaje = false;

        for (const k of ALLOWED_ITEM_FIELDS) {
            if (!isDefined(it[k])) continue;

            if (k === "variation_attributes" && typeof it[k] === "object") {
                itemCols.push(k); itemVals.push(JSON.stringify(it[k])); itemPhs.push("?");
            } else {
                itemCols.push(k); itemVals.push(it[k]); itemPhs.push("?");
            }

            if (["seller_sku", "did_producto", "did_producto_valor"].includes(k)) tieneAnclaje = true;
        }

        if (!tieneAnclaje) {
            throw new CustomException({
                title: "Ítem inválido",
                message: `items[${i}] debe incluir al menos 'seller_sku' o 'did_producto' o 'did_producto_valor'`,
                status: Status.badRequest,
            });
        }

        if (!itemCols.includes("cantidad")) { itemCols.push("cantidad"); itemVals.push(cantidad); itemPhs.push("?"); }

        const insItem = await executeQuery(
            db,
            `INSERT INTO pedidos_productos (${itemCols.join(",")}) VALUES (${itemPhs.join(",")})`,
            itemVals,
            true
        );
        if (insItem && insItem.affectedRows > 0) insertedItems += 1;
    }

    // -------- Historial inicial
    await executeQuery(
        db,
        `INSERT INTO pedidos_historial (did_pedido, estado, quien, superado, elim) VALUES (?, ?, ?, 0, 0)`,
        [did, estadoInicial, userId ?? null],
        true
    );

    return {
        success: true,
        message: "Pedido creado correctamente",
        data: { did, did_cuenta, items: insertedItems },
        meta: { timestamp: new Date().toISOString() },
    };
}
