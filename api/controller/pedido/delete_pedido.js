// controller/pedidos/delete_pedido.js
import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Soft-delete: marca elim=1 en pedido e ítems.
 * (El historial lo dejamos para auditoría; si querés también marcarlo elim=1, descomentalo).
 */
export async function deletePedido(db, req) {
    const didParam = req.body?.did ?? req.params?.did;
    const did = Number(didParam);

    if (!Number.isFinite(did) || did <= 0) {
        throw new CustomException({ title: "Parámetro inválido", message: "'did' debe ser numérico > 0", status: Status.badRequest });
    }

    const cur = await executeQuery(db, `SELECT did FROM pedidos WHERE did = ? AND elim = 0 LIMIT 1`, [did]);
    if (!cur || cur.length === 0) {
        throw new CustomException({ title: "No encontrado", message: `No existe pedido activo con did ${did}`, status: Status.notFound });
    }

    const updItems = await executeQuery(
        db,
        `UPDATE pedidos_productos SET elim = 1 WHERE did_pedido = ? AND elim = 0`,
        [did],
        true
    );

    // Si quisieras eliminar historial:
    // const updHist = await executeQuery(
    //   db,
    //   `UPDATE pedidos_historial SET elim = 1 WHERE did_pedido = ? AND elim = 0`,
    //   [did],
    //   true
    // );

    const updPed = await executeQuery(
        db,
        `UPDATE pedidos SET elim = 1 WHERE did = ? AND elim = 0`,
        [did],
        true
    );

    return {
        success: true,
        message: "Pedido eliminado correctamente",
        data: {
            did,
            affected: {
                pedido: updPed?.affectedRows ?? 0,
                items: updItems?.affectedRows ?? 0,
                // historial: updHist?.affectedRows ?? 0,
            },
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
