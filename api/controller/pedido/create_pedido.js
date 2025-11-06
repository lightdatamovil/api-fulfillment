import { isNonEmpty, LightdataORM } from "lightdata-tools";

export async function createPedido({ db, req }) {
    const userId = Number(req.user.userId);

    const body = req.body || {};
    const pedidosArray = Array.isArray(body?.pedidos) ? body.pedidos : [body];

    const items = pedidosArray.filter((x) => x && typeof x === "object");

    const isSingle = items.length === 1 && !Array.isArray(body?.pedidos);

    const CONCURRENCY = 5;
    const chunks = [];
    for (let i = 0; i < items.length; i += CONCURRENCY) {
        chunks.push(items.slice(i, i + CONCURRENCY));
    }

    const results = [];
    for (const chunk of chunks) {
        const settled = await Promise.allSettled(
            chunk.map((pedido) => insertOnePedido(db, userId, pedido))
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

async function insertOnePedido(db, userId, pedido) {
    const {

        did_cliente,

        deadline,
        fecha_venta,

        observacion,
        total,
        productos,
        direccion,
        id_venta,
        comprador,
        insumos,
    } = pedido || {};

    const [didPedido] = await LightdataORM.insert({
        db,
        table: "pedidos",
        quien: userId,
        data: {
            flex: 0,
            did_cliente: did_cliente,
            status: "paid",
            fecha_venta: fecha_venta,
            deadline: deadline,
            observaciones: observacion,
            total_amount: total,
            number: id_venta,
            buyer_name: comprador.nombre,
            buyer_email: comprador.email,
            buyer_phone: comprador.telefono,
            insumos: JSON.stringify(insumos),

        },
    });

    await LightdataORM.insert({
        db,
        table: "pedidos_historial",
        quien: userId,
        data: {
            did_pedido: didPedido,
            estado: "paid",
            quien: userId,
        },
    });

    const Aproductos = Array.isArray(productos) ? productos : [];

    const rowsDetalle = Aproductos
        .filter((p) => Number(p?.did_producto) > 0 && Number(p?.cantidad) > 0)
        .map((p) => ({
            did_pedido: didPedido,
            did_producto: Number(p.did_producto),
            did_producto_variante_valor: p.did_producto_variante_valor,
            cantidad: Number(p.cantidad),
            variation_attributes: p.variante_descripcion,
            descripcion: p.descripcion,

        }));

    if (rowsDetalle.length > 0) {
        await LightdataORM.insert({
            db,
            table: "pedidos_productos",
            quien: userId,
            data: rowsDetalle,
        });
    }

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
            destination_coments: isNonEmpty(direccion.referencia)
                ? String(direccion.referencia).trim()
                : null,

        };

        const [insertedDidDireccion] = await LightdataORM.insert({
            db,
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
