import { CustomException, LightdataORM } from "lightdata-tools";



export async function egresoStockMasivoArmado({ db, productos, userId }) {

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Debes enviar al menos un producto con sus combinaciones."
        });
    }

    const resultados = [];
    const productos_no_procesados = [];

    for (const producto of productos) {
        const { did_producto, combinaciones } = producto;

        if (!combinaciones || combinaciones.length === 0) {
            throw new CustomException({
                title: "Combinaciones requeridas",
                message: `El producto ${did_producto} no tiene combinaciones para procesar.`
            });
        }

        const didsCombinaciones = combinaciones.map(c => c.did_combinacion);

        // STOCK PRODUCTO (general)
        const stockProductoRow = await LightdataORM.select({
            db,
            table: "stock_producto",
            where: { did_producto_combinacion: didsCombinaciones },
            select: ["did", "did_producto_combinacion", "stock_combinacion"]
        });

        const stockPorCombinacion = new Map(
            stockProductoRow.map(row => [
                row.did_producto_combinacion,
                row
            ])
        );

        // STOCK DETALLE (si no viene en el body)
        const stockProductoDetalleRow = await LightdataORM.select({
            db,
            table: "stock_producto_detalle",
            where: { did_producto_combinacion: didsCombinaciones },
            select: ["did", "did_producto_combinacion", "stock"]
        });

        const stockDetallePorCombinacion = new Map(
            stockProductoDetalleRow.map(row => [
                row.did_producto_combinacion,
                row
            ])
        );

        // VALIDACIÓN DE STOCK
        const combinacionesSinStock = [];

        for (const { did_combinacion, cantidad } of combinaciones) {
            const stockRow = stockPorCombinacion.get(did_combinacion);
            const stockDisponible = stockRow?.stock_combinacion ?? 0;

            if (cantidad > stockDisponible) {
                combinacionesSinStock.push({
                    did_combinacion,
                    requerido: cantidad,
                    disponible: stockDisponible
                });
            }
        }

        if (combinacionesSinStock.length > 0) {
            productos_no_procesados.push({
                did_producto,
                combinaciones_sin_stock: combinacionesSinStock
            });
            continue;
        }

        // EGRESAR STOCK
        for (const { did_combinacion, cantidad, did_stock_producto_detalle } of combinaciones) {

            const stockRow = stockPorCombinacion.get(did_combinacion);
            const cantidadAnterior = stockRow?.stock_combinacion ?? 0;
            const nuevaCantidad = cantidadAnterior - cantidad;

            // stock_producto (siempre)
            await LightdataORM.update({
                db,
                table: "stock_producto",
                quien: userId,
                where: { did: stockRow.did },
                data: { stock_combinacion: nuevaCantidad }
            });

            // stock_producto_detalle
            let detalleRow;

            // 1) Preferir el pasado por body
            if (did_stock_producto_detalle) {
                detalleRow = { did: did_stock_producto_detalle };
            } else {
                // 2) fallback al que ya trae la DB
                detalleRow = stockDetallePorCombinacion.get(did_combinacion);
            }

            if (detalleRow) {
                const stockDetalleAnterior = detalleRow.stock ?? 0;
                const nuevoStockDetalle = stockDetalleAnterior - cantidad;

                await LightdataORM.update({
                    db,
                    table: "stock_producto_detalle",
                    quien: userId,
                    where: { did: detalleRow.did },
                    data: { stock: nuevoStockDetalle }
                });

            } else {
                console.log(`⚠️ No se encontró stock_producto_detalle para combinación ${did_combinacion}`);
            }

            resultados.push({
                did_producto,
                did_combinacion,
                did_stock_producto_detalle: detalleRow?.did || null
            });
        }
    }

    return {
        success: true,
        message: "Stock egresado",
        data: { resultados, productos_no_procesados },
        meta: { timestamp: new Date().toISOString() }
    };
}
