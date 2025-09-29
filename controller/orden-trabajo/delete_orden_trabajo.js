import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Soft delete de la OT y sus vínculos/estados.
 */
export async function deleteOrdenTrabajo(db, req) {
    const didParam = req.body?.did ?? req.params?.did;
    const did = Number(didParam);

    if (!Number.isFinite(did) || did <= 0) {
        throw new CustomException({ title: "Parámetro inválido", message: "'did' debe ser numérico > 0", status: Status.badRequest });
    }

    const cur = await executeQuery(db, `SELECT did FROM ordenes_trabajo WHERE did = ? AND elim = 0 LIMIT 1`, [did]);
    if (!cur || cur.length === 0) {
        throw new CustomException({ title: "No encontrado", message: `No existe OT activa con did ${did}`, status: Status.notFound });
    }

    const updLinks = await executeQuery(
        db,
        `UPDATE ordenes_trabajo_pedidos SET elim = 1 WHERE did_orden_trabajo = ? AND elim = 0`,
        [did],
        true
    );

    const updHist = await executeQuery(
        db,
        `UPDATE ordenes_trabajo_pedidos_estados SET elim = 1 WHERE did_orden_trabajo = ? AND elim = 0`,
        [did],
        true
    );

    const updOT = await executeQuery(
        db,
        `UPDATE ordenes_trabajo SET elim = 1 WHERE did = ? AND elim = 0`,
        [did],
        true
    );

    return {
        success: true,
        message: "Orden de Trabajo eliminada correctamente",
        data: {
            did,
            affected: {
                ot: updOT?.affectedRows ?? 0,
                links: updLinks?.affectedRows ?? 0,
                historial: updHist?.affectedRows ?? 0,
            },
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
