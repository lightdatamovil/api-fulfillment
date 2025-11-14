import { CustomException, LightdataORM } from "lightdata-tools";
import { createRemito } from "../remito/create_remito";

export async function egresoStockMasivo({ db, req }) {

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

        const stockProductoRow = await LightdataORM.select({
            db,
            table: "stock_producto",
            where: { did_producto_combinacion: combinaciones.map(c => c.did_combinacion) },
        });

        for (const combinacion of stockProductoRow) {
            const { cantidad } = combinacion;
            if (combinacion.stock < cantidad) productos_no_procesados.push(did_producto);
        }
        if (productos_no_procesados.includes(producto.did_producto)) {
            continue;
        }
        for (const combinacion of combinaciones) {
            const { cantidad } = combinacion;
            let nuevaCantidad = 0;


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

        const remitoBody = {
            userId,
            did_cliente,
            observaciones: observacion,
            accion: "EGRESO",
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
