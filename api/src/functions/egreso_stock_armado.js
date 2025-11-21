import { LightdataORM } from "lightdata-tools";

export async function egresoStockMasivoArmado({ db, productos, quien }) {
    const resultados = [];
    const errores = [];

    for (const producto of productos) {
        const { did_producto, combinaciones } = producto;

        for (const comb of combinaciones) {
            const { did_combinacion, cantidad, identificadores_especiales } = comb;

            try {
                // ========================================
                // 1) Buscar fila vigente de stock_producto
                // ========================================
                const filas = await LightdataORM.select({
                    db,
                    table: "stock_producto",
                    where: {
                        did_producto: did_producto,
                        did_producto_combinacion: did_combinacion,
                    },
                    throwIfNotExists: true,
                });

                const vigente = filas[0];

                // Chequear stock disponible
                if (vigente.stock_combinacion < cantidad) {
                    errores.push({
                        did_producto,
                        did_combinacion,
                        motivo: "Stock insuficiente",
                    });
                    continue;
                }

                // ========================================
                // 2) Versionar stock_producto (restar stock)
                // ========================================
                await LightdataORM.update({
                    db,
                    table: "stock_producto",
                    where: { did: vigente.did },
                    data: {
                        stock_combinacion: vigente.stock_combinacion - cantidad,
                    },
                    quien,
                });

                // ========================================
                // 3) Versionar stock_producto_detalle
                // ========================================
                for (const det of identificadores_especiales) {
                    const filasDet = await LightdataORM.select({
                        db,
                        table: "stock_producto_detalle",
                        where: { did: det.did },
                        throwIfNotExists: true,
                    });

                    const vigenteDet = filasDet[0];

                    await LightdataORM.update({
                        db,
                        table: "stock_producto_detalle",
                        where: { did: det.did },
                        data: {
                            stock: vigenteDet.stock - det.cantidad,
                        },
                        quien,
                    });
                }

                resultados.push({
                    did_producto,
                    did_combinacion,
                    cantidad,
                    estado: "OK",
                });

            } catch (err) {
                errores.push({
                    did_producto,
                    did_combinacion,
                    error: err.message,
                });
            }
        }
    }

    return {
        success: true,
        message: "Egreso masivo versionado correctamente",
        data: {
        },
    };
}
