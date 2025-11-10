import { LightdataORM, CustomException } from "lightdata-tools";


// Añade la cantodad de stock, al que ya existe, se cuenta de manera acumulativa
export async function addStock({ db, req }) {
    const { did_combinacion,
        cantidad,
        did_producto,
        identificadores_especiales,
        did_deposito
    } = req.body;

    const userId = Number(req.user.userId);


    // verificar si el producto tiene variante

    const productoVerificacion = await LightdataORM.select({
        db,
        table: "productos",
        where: { did: did_producto },
    });

    console.log('Producto verificacion:', productoVerificacion);
    //VERIFICAR SI tiene_ie es 1
    //   const ie = productoVerificacion[0].data_ie;
    if (productoVerificacion[0].tiene_ie == 1) {
        console.log('El producto requiere identificadores especiales.');
        if (!Array.isArray(identificadores_especiales) || identificadores_especiales.length === 0) {
            throw new CustomException({
                title: "Identificadores especiales requeridos",
                message: "El producto requiere identificadores especiales para agregar stock.",
            });
        }

        // los tengo que agrupar en un json para guardar en data_ie asi {1:148, 2:2025/10/6} que esta en el array [] como objetos {did:1, valor:asjda} identificadores especiales

        const data_ie = identificadores_especiales.reduce((acc, item, i) => {
            const { did, valor } = item;
            acc[did] = valor;
            return acc;
        }, {});

        //  console.log('DATA IE a guardar:', data_ie);
    }

    //verifico cuanto hay en la ultima fila de stock

    const sqlUltimoStock = await LightdataORM.select({
        db,
        table: "stock_productos",
        where: {
            did_combinacion: did_combinacion,
            did_producto: did_producto
        },
    });

    console.log('Ultimo stock encontrado:', sqlUltimoStock);

    //sumo cantidad con la nuea cantidad
    const nuevaCantidad = (sqlUltimoStock[0]?.cantidad || 0) + Number(cantidad);

    // actualizo la tabla stock_productos con la nueva cantidad
    await LightdataORM.update({
        db,
        table: "stock_productos",
        quien: userId,
        data: {
            cantidad: nuevaCantidad
        },
        where: {
            did: sqlUltimoStock[0]?.did
        }
    });


    // si hay valores especiales los agrego a la tabla stock_detalle
    if (productoVerificacion[0].tiene_ie == 1) {
        for (const idEspec of identificadores_especiales) {
            const { did, valor } = idEspec;


        }


    }






    //  agrego stock en la tabla stock
    const [newStockId] = await LightdataORM.insert({
        db,
        table: "stock",
        quien: userId,
        data: {
            did_producto,
            did_variante,
            cantidad,
            data_ie
        }
    });



    if (productoVerificacion.data_ie == 1) {
        // marcar los identificadores especiales como usados en la tabla identificadores_especiales
        for (const idEspec of identificadores_especiales) {
            const [key, value] = idEspec.split(":");

        }

    }


    return {
        success: true,
        message: "Variante creada correctamente",
        data: productoVerificacion,
        meta: { timestamp: new Date().toISOString() },
    };
}
