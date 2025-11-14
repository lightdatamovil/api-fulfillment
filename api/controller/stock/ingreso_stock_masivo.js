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
    const productos_no_procesados = [];

    for (const producto of productos) {
        const { did_producto, combinaciones } = producto;

        if (!combinaciones || combinaciones.length === 0) {
            throw new CustomException({
                title: "Combinaciones requeridas",
                message: `El producto ${did_producto} no tiene combinaciones para procesar.`
            });
        }
        const [productRow] = await LightdataORM.select({
            db,
            table: "productos",
            where: { did: did_producto },
        });

        for (const combinacion of combinaciones) {
            if (productRow.tiene_ie && combinacion.identificadores_especiales == null || combinacion.identificadores_especiales.length === 0 || combinacion.identificadores_especiales == undefined) {
                productos_no_procesados.push(did_producto);
            }
        }

        if (productos_no_procesados.includes(producto.did_producto)) {
            continue;
        }
        for (const combinacion of combinaciones) {
            const { did_combinacion, cantidad, identificadores_especiales } = combinacion;
            let nuevaCantidad = 0;
            const stockProductoRow = await LightdataORM.select({
                db,
                table: "stock_producto",
                where: { did_producto_combinacion: did_combinacion },
            });
            let didInsertado;
            if (stockProductoRow.length === 0) {
                didInsertado = await LightdataORM.insert({
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
                const cantidadAnterior = stockProductoRow[0].stock_combinacion || 0;
                nuevaCantidad = cantidadAnterior + cantidad;

                await LightdataORM.update({
                    db,
                    table: "stock_producto",
                    quien: userId,
                    where: { did: stockProductoRow[0].did },
                    data: { stock_combinacion: nuevaCantidad }
                });
            }
            if (identificadores_especiales != null) {
                // flujo  para productos con identificadores especiales ya ingresados

                // Hash único de data_ie
                const hash = createHash("sha256").update(JSON.stringify(identificadores_especiales)).digest("hex");

                const stock_detalle = {
                    did_producto,
                    did_producto_variante_stock: didInsertado,
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
                        where: { did: existingDetalleRow[0].did },
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
    }

    return {
        success: true,
        message: "Stock añadido correctamente y remito generado.",
        data: { resultados, productos_no_procesados },
        meta: { timestamp: new Date().toISOString() }
    };
}
