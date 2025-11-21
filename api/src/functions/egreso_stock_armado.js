import { executeQuery } from "lightdata-tools";

export async function egresoStockMasivoArmado({ db, productos }) {
    for (const producto of productos) {
        const { did_producto, combinaciones } = producto;

        // ================================
        // 1️⃣ ARMAR BATCH PARA stock_producto
        // ================================
        const paramsStock = [];
        const casesStock = [];

        for (const comb of combinaciones) {
            const { did_combinacion, cantidad } = comb;

            casesStock.push(`
                WHEN did_producto = ? 
                 AND did_producto_combinacion = ?
                 AND stock_combinacion >= ?
                THEN stock_combinacion - ?
            `);

            paramsStock.push(did_producto, did_combinacion, cantidad, cantidad);
        }

        if (casesStock.length > 0) {
            const q = `
                UPDATE stock_producto
                SET stock_combinacion = CASE
                    ${casesStock.join("\n")}
                    ELSE stock_combinacion
                END
                WHERE did_producto = ?
            `;

            await executeQuery({
                db,
                query: q,
                values: [...paramsStock, did_producto],
            });
        }

        // ================================
        // 2️⃣ ARMAR BATCH PARA stock_producto_detalle
        // ================================
        const allDetalles = combinaciones.flatMap(c => c.identificadores_especiales);

        if (allDetalles.length > 0) {
            const ids = [];
            const casesDetalle = [];
            const paramsDetalle = [];

            for (const det of allDetalles) {
                casesDetalle.push(`WHEN ? THEN stock - ?`);
                paramsDetalle.push(det.did, det.cantidad);
                ids.push(det.did);
            }

            const q2 = `
                UPDATE stock_producto_detalle
                SET stock = CASE did
                    ${casesDetalle.join("\n")}
                    ELSE stock
                END
                WHERE did IN (${ids.map(() => '?').join(', ')})
            `;

            await executeQuery({
                db,
                query: q2,
                values: [...paramsDetalle, ...ids],
            });
        }
    }

    return {
        success: true,
        message: "Stock egresado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() }
    };
}
