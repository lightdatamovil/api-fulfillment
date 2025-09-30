import { executeQuery } from "lightdata-tools";

export async function createPedido(db, payload, userId) {
    // aseguramos que el pedido tenga ml_id string (nunca null/undefined)
    const pedidoMlId = String(payload?.ml_id ?? payload?.number ?? "").trim();

    const cols = [
        "did_cuenta", "status", "number", "fecha_venta", "buyer_id", "buyer_nickname",
        "buyer_name", "buyer_last_name", "total_amount", "ml_shipment_id", "ml_id",
        "ml_pack_id", "observaciones", "armado", "descargado",
        "quien_armado", "quien", "superado", "elim"
    ];
    const ph = cols.map(() => "?");
    const vals = [
        payload.did_cuenta,
        payload.status,
        payload.number,
        payload.fecha_venta,
        payload.buyer_id,
        payload.buyer_nickname,
        payload.buyer_name,
        payload.buyer_last_name,
        payload.total_amount,
        payload.ml_shipment_id,
        pedidoMlId,                         // <= ya no será null
        payload.ml_pack_id,
        payload.observaciones ?? "",
        payload.armado ?? 0,
        payload.descargado ?? 0,
        payload.quien_armado ?? 0,
        userId ?? 0,
        0,
        0
    ];

    const ins = await executeQuery(
        db,
        `INSERT INTO pedidos (${cols.join(",")}) VALUES (${ph.join(",")})`,
        vals,
        true
    );
    if (!ins?.insertId) throw new Error("No se pudo insertar pedido");

    const id = ins.insertId;
    await executeQuery(db, `UPDATE pedidos SET did = ? WHERE id = ?`, [id, id], true);
    const did = id;

    for (const it of (payload.items || [])) {
        if (!it || Number(it.cantidad) <= 0) continue;

        // Fallback para ml_id de cada item:
        // 1) it.ml_id si viene
        // 2) it.codigo (listing id)
        // 3) pedidoMlId (id de la orden)
        const mlItemIdFinal = String(
            (it.ml_id ?? it.codigo ?? pedidoMlId) ?? ""
        ).trim();

        const icol = [
            "did_pedido", "seller_sku", "codigo", "descripcion", "ml_id", "dimensions",
            "variacion", "id_variacion", "user_product_id", "cantidad", "variation_attributes",
            "imagen", "quien", "superado", "elim"
        ];
        const iph = icol.map(() => "?");
        const ival = [
            did,
            it.seller_sku ?? "",
            it.codigo ?? null,
            it.descripcion ?? null,
            mlItemIdFinal, // <= nunca null
            it.dimensions ?? null,
            it.variacion ?? "",
            it.id_variacion ?? null,
            it.user_product_id ?? null,
            Number(it.cantidad),
            it.variation_attributes ? JSON.stringify(it.variation_attributes) : null,
            it.imagen ?? null,
            userId ?? 0,
            0,
            0
        ];

        await executeQuery(
            db,
            `INSERT INTO pedidos_productos (${icol.join(",")}) VALUES (${iph.join(",")})`,
            ival,
            true
        );
    }

    await executeQuery(
        db,
        `INSERT INTO pedidos_historial (did_pedido, estado, quien, superado, elim) VALUES (?, ?, ?, 0, 0)`,
        [did, payload.status || "created", userId ?? 0],
        true
    );

    return did;
}