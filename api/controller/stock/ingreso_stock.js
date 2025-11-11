import { createHash } from "crypto";
import { LightdataORM, CustomException } from "lightdata-tools";

// dos tablas nuevas remito y remito_item opcional 
// did_cliente obs fecha 
// carga masiva de stock por remito
// stock es por cliente
//  todo agregar stoock = 0 a stock producto


// pegarle al micro de crear remito 

/*
{
did_cliente:1,

    productos: [
        {
            did_producto:1,
            did_combinacion:1,
            cantidad:10,
            "identificadores_especiales": [
        {
            "did": 1,
            "valor": "kdgaoig"
        },
        {
            "did": 2,
            "valor": "kdgYAH"
        }
    ],
        },
        {
            did_producto:1,
            did_combinacion:1,
            cantidad:10
        }
    ]

}
 
*/

// Añade la cantidad de stock, al que ya existe, se cuenta de manera acumulativa
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

    //verifico cuanto hay en la ultima fila de stock
    const stockActual = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: { did_producto_combinacion: did_combinacion },
    });

    let didUpdateResult
    let nuevaCantidadCombinacion
    let nuevaCantidadProducto
    // si es la primera vez que se agrega ese producto 
    if (stockActual.length === 0) {
        //insertar la cantidad

        //verifico si el producto tiene stock para actualizar

        const cantProducto = await LightdataORM.select({
            db,
            table: "stock_producto",
            where: { did_producto: did_producto },
        });

        //calculo nuevo stock
        nuevaCantidadCombinacion = Number(cantidad);
        nuevaCantidadProducto = (cantProducto[0]?.stock_producto || 0) + Number(cantidad);

        [didUpdateResult] = await LightdataORM.insert({
            db,
            table: "stock_producto",
            data: {
                stock_combinacion: cantidad,
                did_deposito: did_deposito,
                stock_producto: nuevaCantidadProducto
            },
            quien: userId,
        });

    } else {
        //sumo cantidad con la nueva cantidad de combinacion
        nuevaCantidadCombinacion = (stockActual[0]?.stock_combinacion || 0) + Number(cantidad);
        nuevaCantidadProducto = (stockActual[0]?.stock_producto || 0) + Number(cantidad);


        // actualizo la tabla stock_productos con la nueva cantidad
        [didUpdateResult] = await LightdataORM.update({
            db,
            table: "stock_producto",
            quien: userId,
            data: {
                stock_combinacion: nuevaCantidadCombinacion,
                did_deposito: did_deposito,
                stock_producto: nuevaCantidadProducto
            },
            where: {
                did: stockActual[0]?.did
            }
        });

    }


    // VERIFICAR SI tiene_ie es 1
    // const ie = productoVerificacion[0].data_ie;
    if (productoVerificacion[0].tiene_ie == 1) {

        if (!Array.isArray(identificadores_especiales) || identificadores_especiales.length === 0) {
            throw new CustomException({
                title: "Identificadores especiales requeridos",
                message: "El producto requiere identificadores especiales para agregar stock.",
            });
        }

        // los tengo que agrupar en un json para guardar en data_ie asi {1:148, 2:2025/10/6} que esta en el array [] como objetos {did:1, valor:asjda} identificadores especiales

        const data_ie = identificadores_especiales.reduce((acc, item) => {
            const { did, valor } = item;
            acc[did] = valor;
            return acc;
        }, {});


        // hashear json data_ie y guardar en hash 256
        const hash = createHash('sha256').update(JSON.stringify(data_ie)).digest('hex');


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

        console.log("stock_detalle", stock_detalle);

        // inserto en stock_producto_detalle : 1 traigo la ultima fila e inserto una nueva y supero la enterior updatear did

        await LightdataORM.insert({
            db,
            table: "stock_producto_detalle",
            quien: userId,
            data: stock_detalle,
        });

    }
    const response = {
        did_combinacion: did_combinacion,
        cantidad_agregada: cantidad,
        stock_actual_producto: nuevaCantidadProducto,
        stock_actual_combinacion: nuevaCantidadCombinacion
    };

    return {
        success: true,
        message: "Stock añadido correctamente",
        data: response,
        meta: { timestamp: new Date().toISOString() },
    };
}



