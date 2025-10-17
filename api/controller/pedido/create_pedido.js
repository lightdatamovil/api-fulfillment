import { isNonEmpty, LightdataORM } from "lightdata-tools";

/**
 * Entrada:
 *  - Objeto simple: { didCuenta, status, ... }
 *  - Objeto con { pedidos: [ { ... }, ... ] }  (MASIVO)
 */
export async function createPedido(dbConnection, req) {
    const userId = Number(req.user.userId);

    // Detectar forma del payload
    const body = req.body || {};
    const pedidosArray = Array.isArray(body?.pedidos) ? body.pedidos : [body];

    // Filtrado mínimo
    const items = pedidosArray.filter((x) => x && typeof x === "object");

    // ¿Es caso individual?
    const isSingle = items.length === 1 && !Array.isArray(body?.pedidos);

    // Concurrencia moderada para no saturar DB
    const CONCURRENCY = 5;
    const chunks = [];
    for (let i = 0; i < items.length; i += CONCURRENCY) {
        chunks.push(items.slice(i, i + CONCURRENCY));
    }

    const results = [];
    for (const chunk of chunks) {
        const settled = await Promise.allSettled(
            chunk.map((pedido) => insertOnePedido(dbConnection, userId, pedido))
        );
        for (const r of settled) {
            if (r.status === "fulfilled") {
                results.push({ success: true, data: r.value });
            } else {
                results.push({
                    success: false,
                    error: r.reason instanceof Error ? r.reason.message : String(r.reason),
                });
            }
        }
    }

    if (isSingle) {
        const r = results[0];
        if (!r.success) {
            return {
                success: false,
                message: "No se pudo crear el pedido",
                error: r.error,
                meta: { timestamp: new Date().toISOString() },
            };
        }
        return {
            success: true,
            message: "Pedido creado correctamente (con historial inicial)",
            data: r.data,
            meta: { timestamp: new Date().toISOString() },
        };
    }

    const ok = results.filter((r) => r.success).length;
    const fail = results.length - ok;
    return {
        success: fail === 0,
        message: `Procesados ${results.length} pedidos (${ok} OK, ${fail} con error)`,
        results,
        meta: { timestamp: new Date().toISOString() },
    };
}

/** Crea UN (1) pedido reutilizando LightdataORM.insert (sin transacciones) */
async function insertOnePedido(dbConnection, userId, pedido) {
    const {
        didCuenta,
        status,
        fecha_venta,
        observaciones,
        total_amount,
        pedidosProducto,
        direccion, // { calle, numero, address_line?, cp, localidad, provincia, pais, latitud, longitud, destination_coments?, hora_desde?, hora_hasta? }
    } = pedido || {};

    // 1) pedidos
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

    // 1b) historial inicial
    await LightdataORM.insert({
        dbConnection,
        table: "pedidos_historial",
        quien: userId,
        data: {
            did: 0, // tu insert luego setea did = id
            did_pedido: didPedido,
            estado: isNonEmpty(status) ? String(status).trim() : "nuevo",
            quien: userId,
            superado: 0,
            elim: 0,
        },
    });

    // 2) detalle (bulk)
    const productos = Array.isArray(pedidosProducto) ? pedidosProducto : [];
    const rowsDetalle = productos
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
            table: "pedidos_productos",
            quien: userId,
            data: rowsDetalle, // BULK
        });
    }

    // 3) dirección (opcional)
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
                direccion.latitud === 0 || isNonEmpty(direccion.latitud) ? Number(direccion.latitud) : null,
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
            table: "pedidos_ordenes_direcciones_destino",
            quien: userId,
            data: rowDireccion,
        });

        didPedidoDireccion = insertedDidDireccion ?? null;
    }

    return {
        did_pedido: didPedido,
        items_insertados: rowsDetalle.length,
        did_pedido_direccion: didPedidoDireccion,
    };
}
