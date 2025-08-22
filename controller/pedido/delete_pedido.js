import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Elimina (soft delete) un pedido y sus derivados.
 * - Marca pedido, items e historial como elim/superado.
 * - Inserta un registro de historial con estado "eliminado".
 */
export async function deletePedido(connection, req) {
    const { pedidoId } = req.params;

    const id = Number(pedidoId);

    // Verificar existencia
    const check = await executeQuery(
        connection,
        "SELECT id, did FROM pedidos WHERE id = ? AND elim = 0 AND superado = 0 LIMIT 1",
        [id],
        true
    );
    if (check.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `El pedido ${id} no existe o ya fue eliminado.`,
            status: Status.notFound,
        });
    }

    const didPedido = check[0].did;

    // Marcar pedido
    await executeQuery(
        connection,
        "UPDATE pedidos SET elim = 1 WHERE id = ? AND superado = 0",
        [id]
    );

    return {
        success: true,
        message: `Pedido ${id} eliminado correctamente.`,
        didPedido,
    };
}
