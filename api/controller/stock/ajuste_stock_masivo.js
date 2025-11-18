import { CustomException, LightdataORM } from "lightdata-tools";
import { createRemito } from "../remito/create_remito.js";

export async function ajusteStockMasivo({ db, req }) {
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
            select: ["did", "did_producto_combinacion", "stock_combinacion"],
            log: true
        });

        // de stock_acumulado did, did_producto_combinacion, stock_combinacion

        const stockPorCombinacion = new Map(
            stockProductoRow.map(row => [
                row.did_producto_combinacion,
                row
            ])
        );

        console.log('stockPorCombinacion', stockPorCombinacion);

        // ─────────────────────────────────────────────
        // 2) Traer stock de stock_producto_detalle
        //    (ajusta columnas según tu tabla real)
        // ─────────────────────────────────────────────
        const stockProductoDetalleRow = await LightdataORM.select({
            db,
            table: "stock_producto_detalle",
            where: { did_producto_combinacion: didsCombinaciones },
            // ajusta los nombres de columnas según tu esquema:
            select: ["did", "did_producto_combinacion", "stock"],
            log: true
            // por ejemplo: ["did", "did_producto_combinacion", "stock_combinacion_detalle"]
        });

        const stockDetallePorCombinacion = new Map(
            stockProductoDetalleRow.map(row => [
                row.did_producto_combinacion,
                row
            ])
        );

        console.log(stockDetallePorCombinacion);

        // ─────────────────────────────────────────────
        // 4) Egresar stock de ambas tablas
        // ─────────────────────────────────────────────
        for (const { did_combinacion, cantidad, did_stock_producto_detalle } of combinaciones) {
            const stockRow = stockPorCombinacion.get(did_combinacion);

            // Update en stock_producto
            await LightdataORM.update({
                db,
                table: "stock_producto",
                quien: userId,
                where: { did: stockRow.did },
                data: { stock_combinacion: cantidad, tipo: "AJUSTE" },
                log: true // ajusta nombre
            });

            // ─────────────────────────────────────────
            // Update en stock_producto_detalle
            // ─────────────────────────────────────────
            const detalleRow = stockDetallePorCombinacion.get(did_combinacion);

            if (detalleRow) {
                console.log('detalleRow', detalleRow);
                const nuevoStockDetalle = cantidad;

                await LightdataORM.update({
                    db,
                    table: "stock_producto_detalle",
                    quien: userId,
                    where: { did: did_stock_producto_detalle },
                    data: { stock: nuevoStockDetalle },
                    log: true // ajusta nombre
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
        data: { resultados },
        meta: { timestamp: new Date().toISOString() }
    };
}
