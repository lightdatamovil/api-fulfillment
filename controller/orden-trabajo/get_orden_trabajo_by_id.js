import { CustomException, executeQuery } from "lightdata-tools";

/**
 * Devuelve la OT + pedidos asignados vigentes + historial por-pedido (últimos N o todos).
 * Query opcional: ?historial=1 para incluir historial completo (default: 1 igualmente).
 */
export async function getOrdenTrabajoById(db, req) {
    const didParam = req.params?.did ?? req.params?.id;
    const did = Number(didParam);

    if (!Number.isFinite(did) || did <= 0) {
        throw new CustomException({ title: "Parámetro inválido", message: "did debe ser numérico > 0" });
    }

    const ot = await executeQuery(
        db,
        `SELECT * FROM ordenes_trabajo WHERE did = ? AND elim = 0 LIMIT 1`,
        [did]
    );
    if (!ot || ot.length === 0) {
        throw new CustomException({ title: "No encontrado", message: `No existe OT con did ${did}` });
    }

    const pedidos = await executeQuery(
        db,
        `SELECT did_orden_trabajo, did_pedido, flex, estado, quien, autofecha
     FROM ordenes_trabajo_pedidos
     WHERE did_orden_trabajo = ? AND elim = 0 AND superado = 0`,
        [did]
    );

    const historial = await executeQuery(
        db,
        `SELECT did, did_pedido, did_orden_trabajo, estado, fecha, quien, autofecha
     FROM ordenes_trabajo_pedidos_estados
     WHERE did_orden_trabajo = ? AND elim = 0
     ORDER BY fecha DESC, autofecha DESC`,
        [did]
    );

    return {
        success: true,
        message: "Orden de Trabajo obtenida correctamente",
        data: {
            orden_trabajo: ot[0],
            pedidos,
            historial,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
