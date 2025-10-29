// controller/pedidos/get_pedido_by_id.js
import { CustomException, executeQuery } from "lightdata-tools";

/**
 * Devuelve snapshot del pedido (did) + items vigentes + historial (todo no eliminado).
 */
export async function getPedidoById(db, req) {
    const didParam = req.params?.did ?? req.params?.id;
    const did = Number(didParam);

    if (!Number.isFinite(did) || did <= 0) {
        throw new CustomException({ title: "Parámetro inválido", message: "did debe ser numérico > 0" });
    }

    const pedidoRows = await executeQuery(
        db,
        `SELECT * FROM pedidos WHERE did = ? AND elim = 0 LIMIT 1`,
        [did]
    );
    if (!pedidoRows || pedidoRows.length === 0) {
        throw new CustomException({ title: "No encontrado", message: `No existe pedido con did ${did}` });
    }

    const items = await executeQuery(
        db,
        `SELECT * FROM pedidos_productos WHERE did_pedido = ? AND elim = 0 AND superado = 0`,
        [did]
    );

    const historial = await executeQuery(
        db,
        `SELECT did_pedido, estado, quien, autofecha 
     FROM pedidos_historial 
     WHERE did_pedido = ? AND elim = 0 
     ORDER BY autofecha DESC`,
        [did]
    );
    const p = pedidoRows[0]
    const pedido = {

        did_pedido: p.did,
        did_cliente: p.did_cliente,
        fecha_venta: p.fecha_venta,
        estado: p.status,
        id_venta: p.number,
        comprador: p.buyer_name,
        total: p.total_amount,
        observacion: p.observaciones,
        armado: p.armado,


        ot: p.ot


    }

    const pp = items[0]
    const pedido_productos = {

        did_pedido: pp.did_pedido,
        did_producto: pp.did_producto,
        variacion: pp.variacion,
        cantidad: pp.cantidad,


    }

    return {
        success: true,
        message: "Pedido obtenido correctamente",
        data: {
            pedido: pedido,
            pedido_productos: pedido_productos,
            historial,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
