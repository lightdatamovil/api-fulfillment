import { LightdataORM } from "lightdata-tools";

export async function editPedido({ db, req }) {
    const userId = Number(req.user.userId);

    const didPedido = Number(
        req.params?.did ?? req.params?.id ?? req.params?.pedidoDid ?? req.body?.did_pedido
    );
    if (!Number.isFinite(didPedido) || didPedido <= 0) {
        throw new Error("did_pedido inválido (no viene en params ni en body).");
    }

    const {
        didCuenta,
        status,
        fecha_venta,
        observaciones,
        total_amount,
        pedidosProducto,
        direccion,
    } = req.body ?? {};

    const updateData = {};
    if (didCuenta !== undefined) updateData.did_cuenta = didCuenta;
    if (status !== undefined) updateData.status = status;
    if (fecha_venta !== undefined) updateData.fecha_venta = fecha_venta;
    if (observaciones !== undefined) updateData.observaciones = observaciones;
    if (total_amount !== undefined) updateData.total_amount = total_amount;

    if (Object.keys(updateData).length > 0) {
        await LightdataORM.update({
            db,
            table: "pedidos",
            where: { did: didPedido },
            quien: userId,
            data: updateData,
        });
    }

    if (status !== undefined) {
        await LightdataORM.insert({
            db,
            table: "pedidos_historial",
            quien: userId,
            data: {
                did: 0,
                did_pedido: didPedido,
                estado: status,
                quien: userId,
                superado: 0,
                elim: 0,
            },
        });
    }

    let agregados = 0;
    let eliminados = 0;

    if (pedidosProducto && typeof pedidosProducto === "object") {
        if (Array.isArray(pedidosProducto.add) && pedidosProducto.add.length > 0) {
            const rowsAdd = pedidosProducto.add.map((p) => ({
                did_pedido: didPedido,
                did_producto: p.did_producto,
                codigo: p.codigo ?? null,
                imagen: p.imagen ?? null,
                descripcion: p.descripcion ?? null,
                dimensions: p.dimensions ?? null,
                cantidad: p.cantidad,
                seller_sku: p.seller_sku ?? null,
            }));

            await LightdataORM.insert({
                db,
                table: "pedidos_productos",
                quien: userId,
                data: rowsAdd,
            });
            agregados = rowsAdd.length;
        }

        if (Array.isArray(pedidosProducto.remove) && pedidosProducto.remove.length > 0) {
            for (const r of pedidosProducto.remove) {
                if (typeof r === "number") {
                    await LightdataORM.delete({
                        db,
                        table: "pedidos_productos",
                        quien: userId,
                        where: { did: r, did_pedido: didPedido },
                    });
                    eliminados++;
                } else if (r?.did_producto) {
                    await LightdataORM.delete({
                        db,
                        table: "pedidos_productos",
                        quien: userId,
                        where: { did_producto: r.did_producto, did_pedido: didPedido },
                    });
                    eliminados++;
                }
            }
        }
    }

    let direccion_upserted = false;
    if (direccion && typeof direccion === "object") {
        const rowDireccion = {
            calle: direccion.calle ?? null,
            numero: direccion.numero ?? null,
            address_line: (
                direccion.address_line ||
                [direccion.calle, direccion.numero].filter(Boolean).join(" ") ||
                null
            ),

            cp: direccion.cp ?? null,
            localidad: direccion.localidad ?? null,
            provincia: direccion.provincia ?? null,
            pais: direccion.pais ?? null,
            latitud: direccion.latitud ?? null,
            longitud: direccion.longitud ?? null,
            destination_coments: direccion.destination_coments ?? null,
            hora_desde: direccion.hora_desde ?? null,
            hora_hasta: direccion.hora_hasta ?? null,
        };

        const existing = await LightdataORM.select({
            db,
            table: "pedidos_ordenes_direcciones_destino",
            where: { did_pedido: didPedido },
        });

        if (existing.length > 0) {
            await LightdataORM.update({
                db,
                table: "pedidos_ordenes_direcciones_destino",
                quien: userId,
                where: { did_pedido: didPedido },
                data: rowDireccion,
            });
        } else {
            await LightdataORM.insert({
                db,
                table: "pedidos_ordenes_direcciones_destino",
                quien: userId,
                data: { did_pedido: didPedido, ...rowDireccion },
            });
        }
        direccion_upserted = true;
    }

    return {
        success: true,
        message: "Pedido actualizado",
        data: {
            did_pedido: didPedido,
            agregados,
            eliminados,
            direccion_upserted,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
