import { isNonEmpty, LightdataORM } from "lightdata-tools";

export async function createPedido(dbConnection, req) {
    const {
        didCuenta,
        status,
        fecha_venta,
        observaciones,
        total_amount,
        pedidosProducto,
        direccion, // { calle, numero, address_line?, cp, localidad, provincia, pais, latitud, longitud, destination_coments?, hora_desde?, hora_hasta? }
    } = req.body;

    const userId = Number(req.user.userId);

    // 1) Insert en "pedidos"
    const [didPedido] = await LightdataORM.insert({
        dbConnection,
        table: "pedidos",
        quien: userId,
        data: {
            did_cuenta: didCuenta,
            status,
            fecha_venta,
            observaciones: isNonEmpty(observaciones) ? String(observaciones).trim() : null,
            total_amount,
        },
    });

    // 1b) PRIMER historial del pedido
    await LightdataORM.insert({
        dbConnection,
        table: "pedidos_historial", // ajustá si tu tabla se llama distinto
        quien: userId,
        data: {
            did: 0,                  // según tu schema (de la captura)
            did_pedido: didPedido,   // FK
            estado: isNonEmpty(status) ? String(status).trim() : "nuevo",
            quien: userId,
            superado: 0,
            elim: 0,
            // autofecha lo maneja la DB como timestamp
        },
    });

    // 2) Detalle de productos
    const items = Array.isArray(pedidosProducto) ? pedidosProducto : [];
    const rowsDetalle = items
        .filter((p) => Number(p?.did_producto) > 0 && Number(p?.cantidad) > 0)
        .map((p) => {
            const normalizedDimensions =
                p?.dimensions == null
                    ? null
                    : typeof p.dimensions === "string"
                        ? p.dimensions.trim()
                        : JSON.stringify(p.dimensions);

            return {
                did_pedido: didPedido,
                did_producto: Number(p.did_producto),
                codigo: isNonEmpty(p?.codigo) ? String(p.codigo).trim() : null,
                imagen: isNonEmpty(p?.imagen) ? String(p.imagen).trim() : null,
                descripcion: isNonEmpty(p?.descripcion) ? String(p.descripcion).trim() : null,
                dimensions: normalizedDimensions,
                cantidad: Number(p.cantidad),
                seller_sku: isNonEmpty(p?.seller_sku) ? String(p.seller_sku).trim() : null,
            };
        });

    if (rowsDetalle.length > 0) {
        await LightdataORM.insert({
            dbConnection,
            table: "pedidos_productos", // o "pedidos_productos"
            quien: userId,
            data: rowsDetalle,
        });
    }

    // 3) Dirección del pedido
    let didPedidoDireccion = null;
    if (direccion && typeof direccion === "object") {
        const calle = isNonEmpty(direccion.calle) ? String(direccion.calle).trim() : null;
        const numero = isNonEmpty(direccion.numero) ? String(direccion.numero).trim() : null;
        const addressLine = isNonEmpty(direccion.address_line)
            ? String(direccion.address_line).trim()
            : [calle, numero].filter(Boolean).join(" ").trim() || null;

        const rowDireccion = {
            did_pedido: didPedido,
            calle,
            numero,
            address_line: addressLine,
            cp: isNonEmpty(direccion.cp) ? String(direccion.cp).trim() : null,
            localidad: isNonEmpty(direccion.localidad) ? String(direccion.localidad).trim() : null,
            provincia: isNonEmpty(direccion.provincia) ? String(direccion.provincia).trim() : null,
            pais: isNonEmpty(direccion.pais) ? String(direccion.pais).trim() : null,
            latitud:
                direccion.latitud === 0 || isNonEmpty(direccion.latitud)
                    ? Number(direccion.latitud)
                    : null,
            longitud:
                direccion.longitud === 0 || isNonEmpty(direccion.longitud)
                    ? Number(direccion.longitud)
                    : null,
            destination_coments: isNonEmpty(direccion.destination_coments)
                ? String(direccion.destination_coments).trim()
                : null,
            hora_desde: isNonEmpty(direccion.hora_desde) ? String(direccion.hora_desde).trim() : null,
            hora_hasta: isNonEmpty(direccion.hora_hasta) ? String(direccion.hora_hasta).trim() : null,
        };

        const [insertedDidDireccion] = await LightdataORM.insert({
            dbConnection,
            table: "pedidos_ordenes_direcciones_destino", // ajustá nombre real
            quien: userId,
            data: rowDireccion,
        });

        didPedidoDireccion = insertedDidDireccion ?? null;
    }

    return {
        success: true,
        message: "Pedido creado correctamente (con historial inicial)",
        data: {
            did_pedido: didPedido,
            items_insertados: rowsDetalle.length,
            did_pedido_direccion: didPedidoDireccion,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
