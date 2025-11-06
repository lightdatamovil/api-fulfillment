import { LightdataORM } from "lightdata-tools";
import { buildMeta } from "../../src/functions/query_utils.js";


export async function getStockActualbyProducto({ db, req }) {
    // taer did_producto y did_variante_valor
    const { did_producto, did_variante_valor } = req.params;
    const didProducto = Number(did_producto);
    const didVarianteValor = did_variante_valor ? Number(did_variante_valor) : null;


    // si did_variante_valor es null o no viene, traer todo el producto, si viene solo traigo esa combinacion

    // para devolver segmento producto por deposito (estaria bien traer un total?) deposito 1 por defecto porque  se entiende que siempre se va aese deposito 

    /* descomentar verificacion si existe producto
        await LightdataORM.select({
            db,
            table: "productos",
            where: { did: didProducto },
            throwIfNotExists: true,
        });
    */

    const stockCombinacion = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: { did_producto_combinacion: didVarianteValor },
        select: ["did_producto_combinacion", "cantidad"],
    });

    console.log("stock", stockCombinacion);


    // mapear para 

    const stockProductos = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: { did_producto: didProducto },
    });


    console.log("stockProductos", stockProductos);

    //mapear la info por did_producto_combinacion


    /*
    //si tiene_ie = 1 , me traigo la oinformacion extra
    if (stockProductos.length === 0) {
        throw new Error("No se encontró stock para el producto indicado");
    }

    // Si el producto no tiene ítems individuales (tiene_ie = 0)
    if (stockProductos[0].tiene_ie === 0) {
        // agrupo 
        const grouped = Object.values(
            stockProductos.reduce((acc, item) => {
                const key = item.did_producto_combinacion;
                if (!acc[key]) {
                    acc[key] = {
                        did_producto_combinacion: key,
                        cantidad: 0,
                    };
                }
                acc[key].cantidad += item.stock ?? 0;
                return acc;
            }, {})
        );

        return {
            success: true,
            message: "Stock agrupado por combinación",
            data: grouped,
            meta: buildMeta({ totalItems: grouped.length }),
        };
    }
*/
    // Si tiene ítems individuales (tiene_ie = 1)
    return {
        success: true,
        message: "Stock detallado por ítem individual",
        data: stockCombinacion,
        meta: buildMeta({ totalItems: stockProductos.length }),
    };
}