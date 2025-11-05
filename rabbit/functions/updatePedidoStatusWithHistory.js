import { executeQuery } from "lightdata-tools";

export
    async function updatePedidoStatusWithHistory(db, did, newStatus, userId, fecha = new Date(), alsoInsertItemsPayload = null) {
    await executeQuery(
        db,
        `UPDATE pedidos SET status = ?, quien = ? WHERE did = ? AND superado = 0 AND elim = 0`,
        [newStatus, userId ?? null, did],
        true
    );

    if (alsoInsertItemsPayload && Array.isArray(alsoInsertItemsPayload.items)) {
        for (const it of alsoInsertItemsPayload.items) {
            if (!it || Number(it.cantidad) <= 0) continue;
            const icol = [
                "did_pedido", "seller_sku", "codigo", "descripcion", "ml_id", "dimensions",
                "variacion", "id_variacion", "user_product_id", "cantidad", "variation_attributes",
                "imagen", "quien", "superado", "elim"
            ];
            const iph = icol.map(() => "?");
            const ival = [
                did, it.seller_sku ?? "", it.codigo ?? null, it.descripcion ?? null, it.ml_id ?? "",
                it.dimensions ?? null, it.variacion ?? null, it.id_variacion ?? null,
                it.user_product_id ?? null, Number(it.cantidad),
                it.variation_attributes ? JSON.stringify(it.variation_attributes) : null,
                it.imagen ?? null, userId ?? null, 0, 0
            ];
            await executeQuery(
                db,
                `INSERT INTO pedidos_productos (${icol.join(",")}) VALUES (${iph.join(",")})`,
                ival,
                true
            );
        }
    }

    await executeQuery(
        db,
        `UPDATE pedidos_historial SET superado = 1 WHERE did_pedido = ? AND superado = 0 AND elim = 0`,
        [did],
        true
    );
    const insH = await executeQuery(
        db,
        `INSERT INTO pedidos_historial (did, did_pedido, estado, fecha, quien, superado, elim)
       VALUES (0, ?, ?, ?, ?, 0, 0)`,
        [did, newStatus, fecha, userId ?? null],
        true
    );
    const idh = insH?.insertId;
    if (idh) {
        await executeQuery({ db, query: `UPDATE pedidos_historial SET did = ? WHERE id = ?`, values: [idh, idh] });
    }

}