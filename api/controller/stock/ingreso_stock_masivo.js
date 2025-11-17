import { createHash } from "crypto";
import { CustomException, LightdataORM } from "lightdata-tools";
import { createRemito } from "../remito/create_remito.js";

export async function ingresoStockMasivo({ db, req }) {
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

        if (!productRow) {
            productos_no_procesados.push({
                did_producto,
                motivo: "El producto no existe en la tabla productos",
            });
            continue;
        }

        // 1) Si el producto tiene IE obligatorios, validamos TODAS las combinaciones
        const combinacionesSinIE = [];

        if (productRow.tiene_ie) {
            for (const { did_combinacion, identificadores_especiales } of combinaciones) {
                const faltanIE =
                    identificadores_especiales == null ||
                    (Array.isArray(identificadores_especiales) &&
                        identificadores_especiales.length === 0);

                if (faltanIE) {
                    combinacionesSinIE.push({ did_combinacion });
                }
            }

            if (combinacionesSinIE.length > 0) {
                productos_no_procesados.push({
                    did_producto,
                    motivo: "Faltan identificadores especiales",
                    combinaciones_sin_ie: combinacionesSinIE,
                });
                // No procesamos stock para este producto
                continue;
            }
        }

        // 2) Procesar combinaciones (ingreso de stock)
        for (const combinacion of combinaciones) {
            const { did_combinacion, cantidad, identificadores_especiales } = combinacion;

            // ── Stock general por combinación ──────────────────────
            const stockProductoRow = await LightdataORM.select({
                db,
                table: "stock_producto",
                where: { did_producto_combinacion: did_combinacion },
            });

            let didStockProducto;
            let nuevaCantidad;

            if (stockProductoRow.length === 0) {
                let didcomb;
                if (!did_combinacion) {
                    didcomb = await LightdataORM.insert({
                        db,
                        table: "producto_variantes_valores",
                        quien: userId,
                        data: {
                            did_producto,
                        },
                    });
                } else {
                    didcomb = did_combinacion;
                }

                didStockProducto = await LightdataORM.insert({
                    db,
                    table: "stock_producto",
                    quien: userId,
                    data: {
                        did_producto,
                        did_producto_combinacion: didcomb,
                        stock_combinacion: cantidad,
                        did_deposito: 1, // ajustar si corresponde
                        tiene_ie: identificadores_especiales != null ? 1 : 0,
                        tipo: "INGRES23O"
                    },
                });

                nuevaCantidad = cantidad;
            } else {
                // Ya existe -> update
                const row = stockProductoRow[0];
                didStockProducto = row.did;
                const cantidadAnterior = row.stock_combinacion || 0;
                nuevaCantidad = cantidadAnterior + cantidad;

                await LightdataORM.update({
                    db,
                    table: "stock_producto",
                    quien: userId,
                    where: { did: didStockProducto, tipo: "INGRESO" },
                    data: { stock_combinacion: nuevaCantidad },
                });
            }

            // ── Detalle con identificadores especiales (si los hay) ──────────
            if (
                identificadores_especiales != null &&
                (!Array.isArray(identificadores_especiales) ||
                    identificadores_especiales.length > 0)
            ) {
                // Hash único de data_ie
                const hash = createHash("sha256")
                    .update(JSON.stringify({
                        did_producto,
                        did_producto_combinacion: did_combinacion,
                        identificadores_especiales,
                    }))
                    .digest("hex");

                const stock_detalle = {
                    did_producto,
                    did_producto_variante_stock: didStockProducto,
                    did_producto_combinacion: did_combinacion,
                    stock: cantidad,
                    data_ie: JSON.stringify(identificadores_especiales),
                    hash,
                };

                const existingDetalleRow = await LightdataORM.select({
                    db,
                    table: "stock_producto_detalle",
                    where: { hash },
                });

                if (existingDetalleRow.length > 0) {
                    // Si se repite el hash, sumamos stock
                    const rowDet = existingDetalleRow[0];
                    const existingStock = rowDet.stock || 0;
                    const updatedStock = existingStock + cantidad;

                    await LightdataORM.update({
                        db,
                        table: "stock_producto_detalle",
                        quien: userId,
                        where: { did: rowDet.did },
                        data: { stock: updatedStock },
                    });
                } else {
                    await LightdataORM.insert({
                        db,
                        table: "stock_producto_detalle",
                        quien: userId,
                        data: stock_detalle,
                    });
                }

            }

            // ── Resultado + líneas para remito ─────────────────────
            resultados.push({
                did_cliente,
                did_producto,
                did_combinacion,
                cantidad_agregada: cantidad,
                stock_actual_combinacion: nuevaCantidad,
            });

            remito_dids.push({
                did_producto,
                did_combinacion,
                cantidad: cantidad.toString(),
            });
        }
    }

    // 3) Crear un solo remito para todo el ingreso (si hay algo que remitir)
    if (remito_dids.length > 0) {
        const remitoBody = {
            userId,
            did_cliente,
            observaciones: observacion,
            accion: "ENTREGA",
            remito_dids,
            fecha,
        };

        await createRemito({ db, ...remitoBody });
    }

    return {
        success: true,
        message: "Stock añadido correctamente y remito generado.",
        data: { resultados, productos_no_procesados },
        meta: { timestamp: new Date().toISOString() },
    };
}
