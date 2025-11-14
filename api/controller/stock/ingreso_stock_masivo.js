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
            const { did_combinacion, cantidad, identificadores_especiales } = combinacion;

            //verifico si tiene identificadores especiales o no con el array y el did

            if (identificadores_especiales == null) {

                // inserto al stock acumulado 
                const resultadoAcu = await procesarStockAcumulado({
                    db,
                    userId,
                    did_producto,
                    did_combinacion,
                    cantidad,
                    identificadores_especiales,
                    did_cliente
                });




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
                    //   const data_ie = identificadores_especiales.reduce((acc, item) => {
                    //       acc[item.did] = item.valor;
                    //       return acc;
                    //   }, {});

                    // Hash único de data_ie
                    const hash = createHash("sha256").update(JSON.stringify(identificadores_especiales)).digest("hex");

                    const stock_detalle = {
                        did_producto,
                        did_producto_combinacion: did_combinacion,
                        stock: cantidad,
                        data_ie: JSON.stringify(identificadores_especiales),
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

        nuevaCantidadCombinacion = Number(cantidad);
        //    nuevaCantidadProducto = (cantProducto[0]?.stock_producto || 0) + Number(cantidad);


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

    if (Array.isArray(identificadores_especiales) || identificadores_especiales.length > 0) {

        // Hash único de data_ie
        const hash = createHash("sha256").update(JSON.stringify(didentificadores_especiales)).digest("hex");

        // comparo si ya existe otra linea d ese hash creado y updateo el valor

        const verificoHash = await LightdataORM.select({
            db,
            table: "stock_producto_detalle",
            where: { hash },
        })

        console.log('EXISTE STOCK DETALLE CON ESE HASH', hash);

        if (verificoHash.length > 0) {


            // update el stock de producto detalle
            await LightdataORM.update({
                db,
                table: "stock_producto_detalle",
                quien: userId,
                where: { hash },
                data: { stock: cantidad }
            });
        }



        const stock_detalle = {
            did_producto,
            did_producto_combinacion: did_combinacion,
            stock: cantidad,
            data_ie: JSON.stringify(identificadores_especiales),
            did_producto_variante_stock: didUpdateResult,
            hash
        };

        await LightdataORM.insert({
            db,
            table: "stock_producto_detalle",
            quien: userId,
            data: stock_detalle,
        });


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
});



