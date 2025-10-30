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

    const direccion = await executeQuery(
        db,
        `SELECT * FROM pedidos_ordenes_direcciones_destino WHERE did_pedido = ? AND elim = 0 LIMIT 1`,
        [did]
    );


    const p = pedidoRows[0]
    const pd = direccion[0] || {}

    const pp = items[0]
    const pedido_productos = {
        did: pp.did,
        did_pedido: pp.did_pedido,
        did_producto: pp.did_producto,
        did_producto_variante_valor: pp.variacion,
        cantidad: pp.cantidad,



    }
    const comprador = {
        nombre: p.buyer_name,
        email: p.buyer_email,
        telefono: p.buyer_phone,
    }
    const direccion_pedido = {
        calle: pd.calle,
        numero: pd.numero,
        localidad: pd.localidad,
        provincia: pd.provincia,
        pais: pd.pais,
        cp: pd.cp,
        latitud: pd.latitud,
        longitud: pd.longitud,
    }

    const pedido = {

        did_pedido: p.did,
        did_cliente: p.did_cliente,
        did_deposito: p.did_deposito,
        fecha_venta: p.fecha_venta,
        estado: p.status,
        id_venta: p.number,

        total: p.total_amount,
        observacion: p.observaciones,
        armado: p.armado,
        deadline: p.deadline,
        ot: p.ot,
        comprador: comprador,
        direccion: direccion_pedido,
        producto: pedido_productos,





    }


    return {
        success: true,
        message: "Pedido obtenido correctamente",
        pedido,
        meta: { timestamp: new Date().toISOString() },
    };
}
