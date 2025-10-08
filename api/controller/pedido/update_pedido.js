// controller/pedidos/update_pedido.js
import { CustomException, executeQuery, Status, isDefined, isNonEmpty } from "lightdata-tools";

// alias body -> columna real
const PEDIDOS_FIELD_MAP = {
    shipment_id: "ml_shipment_id",
    pack_id: "ml_pack_id",
    order_id: "ml_id",
    total: "total_amount",
    buyer_fullname: null,
};

// columnas REALES permitidas para UPDATE en pedidos
const ALLOWED_PEDIDOS = [
    "status", "number", "fecha_venta",
    "ml_shipment_id", "ml_pack_id", "ml_id", "site_id", "currency_id",
    "buyer_id", "buyer_nickname", "buyer_name", "buyer_last_name", "buyer_email",
    "total_amount", "subtotal", "shipping_cost", "discount_amount",
    "armado", "descargado", "quien_armado", "seller_id", "observaciones",
    "receiver_name", "receiver_phone", "address_line", "city", "state", "zip_code",
];

// columnas permitidas en pedidos_productos (deben existir en tu tabla)
const ALLOWED_ITEM_FIELDS = [
    "did_producto", "did_producto_valor", "id_variacion",
    "codigo", "imagen", "descripcion", "ml_id", "dimensions", "variacion", "seller_sku",
    "user_product_id",
    "cantidad",
    "variation_attributes",
];

export async function updatePedido(db, req) {
    const { userId } = req.user ?? {};
    const body = req.body || {};
    const didParam = body.did ?? req.params?.did;
    const did = Number(didParam);

    if (!Number.isFinite(did) || did <= 0) {
        throw new CustomException({ title: "Parámetro inválido", message: "'did' debe ser numérico > 0", status: Status.badRequest });
    }

    // Verificar que exista
    const cur = await executeQuery(db, `SELECT did FROM pedidos WHERE did = ? AND elim = 0 LIMIT 1`, [did]);
    if (!cur || cur.length === 0) {
        throw new CustomException({ title: "No encontrado", message: `No existe pedido activo con did ${did}`, status: Status.notFound });
    }

    // (Opcional) partir buyer_fullname
    if (isNonEmpty(body.buyer_fullname)) {
        if (!body.buyer_name && !body.buyer_last_name) {
            const parts = String(body.buyer_fullname).trim().split(/\s+/);
            body.buyer_name = parts.shift() || "";
            body.buyer_last_name = parts.join(" ");
        }
    }

    // ------- UPDATE dinámico (solo campos que vengan y estén whitelisted)
    const sets = [];
    const params = [];

    for (const [kRaw, v] of Object.entries(body)) {
        if (!isDefined(v)) continue;
        if (kRaw === "items" || kRaw === "did" || kRaw === "did_cuenta") continue;

        const mapped = Object.prototype.hasOwnProperty.call(PEDIDOS_FIELD_MAP, kRaw)
            ? PEDIDOS_FIELD_MAP[kRaw]
            : kRaw;

        if (!mapped) continue;                      // ej buyer_fullname
        if (!ALLOWED_PEDIDOS.includes(mapped)) continue;

        sets.push(`${mapped} = ?`);
        params.push(v);
    }

    if (sets.length > 0) {
        params.push(did);
        await executeQuery(db, `UPDATE pedidos SET ${sets.join(", ")} WHERE did = ? AND elim = 0`, params);
    }

    // ------- Resync de items si vienen en el body
    if (Array.isArray(body.items)) {
        // superar vigentes
        await executeQuery(
            db,
            `UPDATE pedidos_productos SET superado = 1 WHERE did_pedido = ? AND elim = 0 AND superado = 0`,
            [did],
            true
        );

        // insertar nuevos
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

            await executeQuery(
                db,
                `INSERT INTO pedidos_productos (${itemCols.join(",")}) VALUES (${itemPhs.join(",")})`,
                itemVals,
                true
            );
        }
    }

    // ------- Historial
    const estado = isNonEmpty(body.status) ? String(body.status) : "updated";
    await executeQuery(
        db,
        `INSERT INTO pedidos_historial (did_pedido, estado, quien, superado, elim) VALUES (?, ?, ?, 0, 0)`,
        [did, estado, userId ?? null],
        true
    );

    return {
        success: true,
        message: "Pedido actualizado correctamente",
        data: { did },
        meta: { timestamp: new Date().toISOString() },
    };
}
