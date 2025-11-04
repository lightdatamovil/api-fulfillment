import { LightdataORM } from "lightdata-tools";

export async function getPedidoById({ db, req }) {
    const didParam = req.params?.did ?? req.params?.id;
    const did = Number(didParam);

    const [pedido] = await LightdataORM.select({
        db,
        table: "pedidos",
        where: { did },
        throwIfNotExists: true,
    });

    const items = await LightdataORM.select({
        db,
        table: "pedidos_productos",
        where: { did_pedido: did },
    });

    const [direccion] = await LightdataORM.select({
        db,
        table: "pedidos_ordenes_direcciones_destino",
        where: { did_pedido: did },
        limit: 1,
    });

    const productos = items.map(pp => ({
        did: pp.did,
        did_producto: pp.did_producto,
        did_producto_variante_valor: pp.did_producto_variante_valor,
        cantidad: pp.cantidad,
        precio_unitario: pp.precio_unitario,
        subtotal: pp.subtotal,
        descripcion: pp.descripcion,
        variante_descripcion: pp.variation_attributes,
    }));

    const comprador = {
        nombre: pedido.buyer_name,
        email: pedido.buyer_email,
        telefono: pedido.buyer_phone,
    };

    const direccion_pedido = {
        calle: direccion.calle,
        numero: direccion.numero,
        localidad: direccion.localidad,
        provincia: direccion.provincia,
        pais: direccion.pais,
        cp: direccion.cp,
        latitud: direccion.latitud,
        longitud: direccion.longitud,
        referencia: direccion.destination_coments,
    };

    const data = {
        did: pedido.did,
        did_cliente: pedido.did_cliente,
        did_deposito: pedido.did_deposito,
        fecha_venta: pedido.fecha_venta,
        flex: pedido.flex,
        estado: pedido.status,
        id_venta: pedido.number,
        total: pedido.total_amount,
        observacion: pedido.observaciones,
        armado: pedido.armado,
        deadline: pedido.deadline,
        trabajado: pedido.trabajado,
        comprador,
        direccion: direccion_pedido,
        productos,
    };

    return {
        success: true,
        message: "Pedido obtenido correctamente",
        data,
        meta: { timestamp: new Date().toISOString() },
    };
}
