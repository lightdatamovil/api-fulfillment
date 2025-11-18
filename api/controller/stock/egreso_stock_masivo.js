import { CustomException, LightdataORM } from "lightdata-tools";
import { createRemito } from "../remito/create_remito.js";

export async function egresoStockMasivo({ db, req }) {
    const { did_cliente, productos, observacion, fecha } = req.body;
    const userId = Number(req.user.userId);

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Debes enviar al menos un producto con sus combinaciones."
        });
    }

    const resultados = [];
    const remito_dids = [];
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

        // ─────────────────────────────────────────────
        // 1) Traer stock de stock_producto
        // ─────────────────────────────────────────────
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

        // ─────────────────────────────────────────────
        // 2) Traer stock de stock_producto_detalle
        //    (ajusta columnas según tu tabla real)
        // ─────────────────────────────────────────────
        const stockProductoDetalleRow = await LightdataORM.select({
            db,
            table: "stock_producto_detalle",
            where: { did_producto_combinacion: didsCombinaciones },
            // ajusta los nombres de columnas según tu esquema:
            select: ["did", "did_producto_combinacion", "stock"]
            // por ejemplo: ["did", "did_producto_combinacion", "stock_combinacion_detalle"]
        });

        const stockDetallePorCombinacion = new Map(
            stockProductoDetalleRow.map(row => [
                row.did_producto_combinacion,
                row
            ])
        );

        // ─────────────────────────────────────────────
        // 3) Validar que TODAS las combinaciones tengan stock suficiente
        //    (usamos stock_producto como referencia principal)
        // ─────────────────────────────────────────────
        const combinacionesSinStock = [];

        for (const { did_combinacion, cantidad } of combinaciones) {
            const stockRow = stockPorCombinacion.get(did_combinacion);
            const stockDisponible = stockRow ? stockRow.stock_combinacion || 0 : 0;

            if (cantidad > stockDisponible) {
                combinacionesSinStock.push({
                    did_combinacion,
                    requerido: cantidad,
                    disponible: stockDisponible,
                });
            }
        }

        if (combinacionesSinStock.length > 0) {
            productos_no_procesados.push({
                did_producto,
                combinaciones_sin_stock: combinacionesSinStock,
            });
            // No egresamos nada para este producto
            continue;
        }

        // ─────────────────────────────────────────────
        // 4) Egresar stock de ambas tablas
        // ─────────────────────────────────────────────
        for (const { did_combinacion, cantidad, did_stock_producto_detalle } of combinaciones) {
            const stockRow = stockPorCombinacion.get(did_combinacion);

            /*
                        if (did_stock_producto_detalle){
            
                            // calculo nueva cantidad
                            const cantidadNueva = stockRow.stock - cantidad;
                            // descuento de aca
                            await LightdataORM.update({
                                db,
                                table: "stock_producto_detalle",
                                quien: userId,
                                where: { did: did_stock_producto_detalle },
                                data: { stock: cantidad} // ajusta nombre
                            });
                        }
                            */

            if (!stockRow) {
                productos_no_procesados.push({
                    did_producto,
                    combinaciones_sin_stock: [
                        { did_combinacion, requerido: cantidad, disponible: 0 },
                    ],
                });
                continue;
            }

            const cantidadAnterior = stockRow.stock_combinacion || 0;
            const nuevaCantidad = cantidadAnterior - cantidad; // EGRESO

            // Update en stock_producto
            await LightdataORM.update({
                db,
                table: "stock_producto",
                quien: userId,
                where: { did: stockRow.did, tipo: "EGRESO" },
                data: { stock_combinacion: nuevaCantidad }
            });

            // ─────────────────────────────────────────
            // Update en stock_producto_detalle
            // ─────────────────────────────────────────
            const detalleRow = stockDetallePorCombinacion.get(did_combinacion);

            if (detalleRow) {
                const stockDetalleAnterior = detalleRow.stock || 0; // ajusta nombre de columna
                const nuevoStockDetalle = stockDetalleAnterior - cantidad;  // EGRESO

                await LightdataORM.update({
                    db,
                    table: "stock_producto_detalle",
                    quien: userId,
                    where: { did: did_stock_producto_detalle },
                    data: { stock: nuevoStockDetalle } // ajusta nombre
                });
            } else {
                // Si no hay detalle, podés:
                // - o bien crear uno
                // - o loguear el caso
                console.log(
                    `⚠️ No se encontró stock_producto_detalle para combinación ${did_combinacion}`
                );
            }

            resultados.push({
                did_producto,
                did_combinacion,
            });

            const remitoBody = {
                userId,
                did_cliente,
                observaciones: observacion,
                accion: "EGRESO",
                remito_dids,
                fecha
            };

            await createRemito({ db, ...remitoBody });
        }
    }

    return {
        success: true,
        message: "Stock egresado y remitos generados.",
        data: { resultados, productos_no_procesados },
        meta: { timestamp: new Date().toISOString() }
    };
}
