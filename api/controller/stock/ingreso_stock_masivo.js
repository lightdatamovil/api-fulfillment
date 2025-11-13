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
    const remito_dids = []; // acumularemos acá los datos para el micro de remitos

    for (const producto of productos) {
        const { did_producto, combinaciones } = producto;

        if (!combinaciones || combinaciones.length === 0) {
            throw new CustomException({
                title: "Combinaciones requeridas",
                message: `El producto ${did_producto} no tiene combinaciones para procesar.`
            });
        }

        for (const combinacion of combinaciones) {
            const { did_combinacion, cantidad, did_stock_producto_detalle, identificadores_especiales } = combinacion;

            //verifico si tiene identificadores especiales o no con el array y el did

            if (did_stock_producto_detalle && identificadores_especiales.length > 0) {
                // flujo  para productos con identificadores especiales ya ingresados

                // verifico si ya existe en el sistema
                if (did_stock_producto_detalle != null) {
                    await LightdataORM.update({
                        db,
                        table: "stock_producto_detalle",
                        quien: userId,
                        where: { did: did_stock_producto_detalle },
                        data: { stock: cantidad }
                    });
                }


                else {
                    // flujo para agregar un did combinacion nuevo con identificadores especiales
                    // Convertir array a JSON {did: valor}
                    const data_ie = identificadores_especiales.reduce((acc, item) => {
                        acc[item.did] = item.valor;
                        return acc;
                    }, {});

                    // Hash único de data_ie
                    const hash = createHash("sha256").update(JSON.stringify(data_ie)).digest("hex");

                    const stock_detalle = {
                        did_producto,
                        did_producto_combinacion: did_combinacion,
                        stock: cantidad,
                        data_ie: JSON.stringify(data_ie),
                        hash
                    };

                    await LightdataORM.insert({
                        db,
                        table: "stock_producto_detalle",
                        quien: userId,
                        data: stock_detalle
                    });
                }


                const resultado = await procesarStock({
                    db,
                    userId,
                    did_producto,
                    did_combinacion,
                    cantidad,
                    identificadores_especiales,
                    did_cliente
                });

                resultados.push(resultado.data);

                // construir item de remito
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

    //revisar suma de did_producto
    //revisar did_deposito no se esta enviando bien


    // -------------------------------------------------------------
    // Lógica interna reutilizable
    // -------------------------------------------------------------
    async function procesarStock({
        db,
        userId,
        did_producto,
        did_combinacion,
        cantidad,
        identificadores_especiales,
        did_deposito,
        did_cliente
    }) {
        // Verificar si el producto existe y tiene identificadores especiales
        const [productoVerificacion] = await LightdataORM.select({
            db,
            table: "productos",
            where: { did: did_producto },
        });

        if (!productoVerificacion) {
            throw new CustomException({
                title: "Producto no encontrado",
                message: `El producto con ID ${did_producto} no existe.`,
            });
        }

        // Verificar stock actual
        const stockActual = await LightdataORM.select({
            db,
            table: "stock_producto",
            where: { did_producto_combinacion: did_combinacion },
        });

        let didUpdateResult;
        let nuevaCantidadCombinacion;
        let nuevaCantidadProducto;

        if (stockActual.length === 0) {

            // Si no existe registro previo de stock para esa combinación
            const cantProducto = await LightdataORM.select({
                db,
                table: "stock_producto",
                where: { did_producto },
            });

            nuevaCantidadCombinacion = Number(cantidad);
            nuevaCantidadProducto = (cantProducto[0]?.stock_producto || 0) + Number(cantidad);


            [didUpdateResult] = await LightdataORM.insert({
                db,
                table: "stock_producto",
                data: {
                    stock_combinacion: cantidad,
                    did_deposito: did_deposito,
                    stock_producto: nuevaCantidadProducto,
                    did_producto,
                    did_producto_combinacion: did_combinacion,
                    tiene_ie: productoVerificacion[0].tiene_ie

                },
                quien: userId,
            });
        } else {

            nuevaCantidadCombinacion = (stockActual[0]?.stock_combinacion || 0) + Number(cantidad);
            // Buscar el stock total actual del producto (no de la combinación)
            const stockProductoActual = await LightdataORM.select({
                db,
                table: "stock_producto",
                where: { did_producto: did_producto },
            });

            // Sumar todos los stock_producto de las combinaciones del mismo producto
            const stockAnteriorProducto = stockProductoActual.reduce(
                (acc, row) => acc + Number(row.stock_combinacion || 0),
                0
            );

            // Ahora sumamos la nueva cantidad a ese acumulado total
            nuevaCantidadProducto = stockAnteriorProducto + Number(cantidad);


            [didUpdateResult] = await LightdataORM.update({
                db,
                table: "stock_producto",
                quien: userId,
                data: {
                    stock_combinacion: nuevaCantidadCombinacion,
                    stock_producto: nuevaCantidadProducto,
                    did_deposito: did_deposito
                },
                where: { did: stockActual[0].did },
            });
        }

        // Si el producto tiene identificadores especiales (tiene_ie = 1)
        if (productoVerificacion.tiene_ie == 1) {
            if (!Array.isArray(identificadores_especiales) || identificadores_especiales.length === 0) {
                throw new CustomException({
                    title: "Identificadores especiales requeridos",
                    message: `El producto ${did_producto} requiere identificadores especiales.`,
                });
            }



            // Hash único de data_ie
            const hash = createHash("sha256").update(JSON.stringify(data_ie)).digest("hex");

            const stock_detalle = {
                did_producto,
                did_producto_combinacion: did_combinacion,
                stock: cantidad,
                data_ie: JSON.stringify(data_ie),
                did_producto_variante_stock: didUpdateResult,
                hash
            };

            await LightdataORM.insert({
                db,
                table: "stock_producto_detalle",
                quien: userId,
                data: stock_detalle,
            });
        }

        const response = {
            did_cliente,
            did_producto,
            did_combinacion,
            cantidad_agregada: cantidad,
            stock_actual_producto: nuevaCantidadProducto,
            stock_actual_combinacion: nuevaCantidadCombinacion
        };

        return {
            success: true,
            message: "Stock añadido correctamente",
            data: response,
        };
    }
}