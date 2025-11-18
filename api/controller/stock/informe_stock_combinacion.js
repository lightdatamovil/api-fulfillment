import { executeQuery, LightdataORM } from "lightdata-tools";


export async function informeStockCombinacion({ db, req }) {
    const { did_cliente, did_producto } = req.params;

    const query = `SELECT * FROM stock_producto WHERE did_producto = ?`;

    const movimientos = await executeQuery({
        db,
        query,
        values: [did_producto],
        log: true
    });

    console.log('combinacionRowsIe', movimientos)

    const queryIe = `SELECT * FROM stock_producto_detalle WHERE did_producto = ?`;

    const detalles = await executeQuery({
        db,
        query: queryIe,
        values: [did_producto],
        log: true
    });
    console.log('detallesIe', detalles)

    //mapear todo por did_combinacion 
    // Mapa rápido para buscar detalles por movimiento
    const mapDetalles = {};
    detalles.forEach(det => {
        mapDetalles[det.did_producto_variante_stock] = det;
    });

    // 3️⃣ Armar estructura final
    const resultado = movimientos.map(mov => {
        const det = mapDetalles[mov.id];

        return {
            did_combinacion: mov.did_producto_combinacion,
            movimientos: {
                fecha: new Date(mov.autofecha).toLocaleDateString("es-AR"),
                quien: mov.quien,
                tipo: mov.tipo,
                observacion_ajuste_stock: mov.observaciones || null,
                identificadores_especiales: det ? JSON.parse(det.data_ie || "[]") : [],
                id_venta_pedido: mov.id_venta_pedido || null,
                movimiento: det ? det.stock : 0,  // cantidad movida
                acumulado: mov.stock_combinacion,
                id_venta: mov.id_venta,
            }
        };
    });

    return {
        success: true,
        data: resultado
    };
}






