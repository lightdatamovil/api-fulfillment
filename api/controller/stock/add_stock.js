import { createHash } from "crypto";
import { LightdataORM, CustomException } from "lightdata-tools";


// Añade la cantodad de stock, al que ya existe, se cuenta de manera acumulativa
export async function addStock({ db, req }) {
    const {
        did_combinacion,
        cantidad,
        did_producto,
        identificadores_especiales,
        did_deposito
    } = req.body;

    const userId = Number(req.user.userId);

    // verificar si el producto tiene variantes
    const productoVerificacion = await LightdataORM.select({
        db,
        table: "productos",
        where: { did: did_producto },
    });

    console.log('Producto verificacion:', productoVerificacion);

    //verifico cuanto hay en la ultima fila de stock
    const stockActual = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: { did_producto_combinacion: did_combinacion },
    });

    console.log('Ultimo stock encontrado:', stockActual[0].stock);

    //sumo cantidad con la nueva cantidad
    const nuevaCantidad = (stockActual[0]?.stock || 0) + Number(cantidad);

    console.log('Nueva cantidad calculada:', nuevaCantidad);

    // actualizo la tabla stock_productos con la nueva cantidad
    const [didUpdateResult] = await LightdataORM.update({
        db,
        table: "stock_producto",
        quien: userId,
        data: {
            stock: nuevaCantidad,
            did_deposito: did_deposito
        },
        where: {
            did: stockActual[0]?.did
        }
    });

    console.log('Resultado de la actualización del stock:', didUpdateResult);

    // VERIFICAR SI tiene_ie es 1
    // const ie = productoVerificacion[0].data_ie;
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


        // hashear json data_ie y guardar en hash 256
        const hash = createHash('sha256').update(JSON.stringify(data_ie)).digest('hex');
        console.log('Hash generado:', hash);


        //armo para insertar
        const stock_detalle =
        {
            did_producto: did_producto,
            did_producto_combinacion: did_combinacion,
            stock: cantidad,
            data_ie: JSON.stringify(data_ie),
            did_producto_variante_stock: didUpdateResult,
            hash: hash
        };
        console.log('Detalle de stock a insertar:', stock_detalle);

        console.log('DATA IE a guardar:', data_ie);

        // inserto en stock_producto_detalle : 1 traigo la ultima fila e inserto una nueva y supero la enterior updatear did

        await LightdataORM.insert({
            db,
            table: "stock_producto_detalle",
            quien: userId,
            data: stock_detalle,
        });



        return {
            success: true,
            message: "Variante creada correctamente",
            data: productoVerificacion,
            meta: { timestamp: new Date().toISOString() },
        };
    }

}

