import { createHash } from "crypto";
import { CustomException, LightdataORM } from "lightdata-tools";
import { createRemito } from "../remito/create_remito.js";

export async function ingresoStock({ db, req }) {
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

        for (const combinacion of combinaciones) {
            const { did_combinacion, cantidad, identificadores_especiales } = combinacion;
            let nuevaCantidad = 0;
            const cantidadAnteriorRow = await LightdataORM.select({
                db,
                table: "stock_producto",
                where: { did_producto_combinacion: did_combinacion },
            });
            if (cantidadAnteriorRow.length === 0) {
                await LightdataORM.insert({
                    db,
                    table: "stock_producto",
                    quien: userId,
                    data: {
                        did_producto,
                        did_producto_combinacion: did_combinacion,
                        stock_combinacion: cantidad,
                        did_deposito: 1,
                        tiene_ie: identificadores_especiales != null ? 1 : 0
                    }
                });
            } else {
                const cantidadAnterior = cantidadAnteriorRow[0].stock_combinacion || 0;
                nuevaCantidad = cantidadAnterior + cantidad;
                await LightdataORM.update({
                    db,
                    table: "stock_producto",
                    quien: userId,
                    where: { did_producto_combinacion: did_combinacion },
                    versionKey: "did_producto_combinacion",
                    data: { stock_combinacion: nuevaCantidad }
                });
            }
            if (identificadores_especiales != null) {
                // flujo  para productos con identificadores especiales ya ingresados

                // Hash único de data_ie
                const hash = createHash("sha256").update(JSON.stringify(identificadores_especiales)).digest("hex");

                const stock_detalle = {
                    did_producto,
                    did_producto_combinacion: did_combinacion,
                    stock: cantidad,
                    data_ie: JSON.stringify(identificadores_especiales),
                    hash
                };

                const existingDetalleRow = await LightdataORM.select({
                    db,
                    table: "stock_producto_detalle",
                    where: { hash },
                });

                if (existingDetalleRow.length > 0) {
                    //! SI SE REPITE EL HASH CAGAMOS
                    const existingStock = existingDetalleRow[0].stock || 0;
                    const updatedStock = existingStock + cantidad;

                    await LightdataORM.update({
                        db,
                        table: "stock_producto_detalle",
                        quien: userId,
                        where: { hash },
                        data: { stock: updatedStock }
                    });
                } else {
                    await LightdataORM.insert({
                        db,
                        table: "stock_producto_detalle",
                        quien: userId,
                        data: stock_detalle
                    });
                }

                resultados.push({
                    did_cliente,
                    did_producto,
                    did_combinacion,
                    cantidad_agregada: cantidad,
                    stock_actual_combinacion: nuevaCantidad
                });

                remito_dids.push({
                    did_producto,
                    did_combinacion,
                    cantidad: cantidad.toString()
                });
            }
        }

        const remitoBody = {
            userId,
            did_cliente,
            observaciones: observacion,
            accion: "ENTREGA",
            remito_dids,
            fecha
        };

        await createRemito({ db, ...remitoBody });

        return {
            success: true,
            message: "Stock añadido correctamente y remito generado.",
            data: resultados,
            meta: { timestamp: new Date().toISOString() }
        };
    }
}
