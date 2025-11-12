import { createHash } from "crypto";
import { CustomException, LightdataORM } from "lightdata-tools";
import { createRemito } from "../remito/create_remito.js";

export async function ajusteStock({ db, req }) {
    const { did_cliente, productos, did_deposito, observacion, fecha } = req.body;
    const userId = Number(req.user.userId);

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Debes enviar al menos un producto con sus combinaciones.",
        });
    }

    const resultados = [];
    //   const remito_dids = [];

    for (const producto of productos) {
        const { did_producto, combinaciones } = producto;

        if (!combinaciones || combinaciones.length === 0) {
            throw new CustomException({
                title: "Combinaciones requeridas",
                message: `El producto ${did_producto} no tiene combinaciones para procesar.`,
            });
        }

        // --- Ajustar cada combinación ---
        for (const combinacion of combinaciones) {
            const { did_combinacion, cantidad, identificadores_especiales } = combinacion;

            const resultado = await procesarAjuste({
                db,
                userId,
                did_producto,
                did_combinacion,
                cantidad,
                identificadores_especiales,
                did_deposito,
                did_cliente,
            });

            resultados.push(resultado.data);

        }
        // --- Recalcular stock total del producto ---
        const combinacionesActuales = await LightdataORM.select({
            db,
            table: "stock_producto",
            where: { did_producto },
        });

        const totalRecalculado = combinacionesActuales.reduce(
            (acc, row) => acc + Number(row.stock_combinacion || 0),
            0
        );

        // actualizar stock total del producto (en todas sus combinaciones)
        for (const row of combinacionesActuales) {
            await LightdataORM.update({
                db,
                table: "stock_producto",
                quien: userId,
                data: { stock_producto: totalRecalculado },
                where: { did: row.did },
            });
        }

        console.log(
            `🔄 Stock del producto ${did_producto} recalculado: ${totalRecalculado}`
        );
    }
    return {
        success: true,
        message: "Stock ajustado correctamente y remito generado.",
        data: resultados,
        meta: { timestamp: new Date().toISOString() },
    };
}

// -------------------------------------------------------------
// Función auxiliar: procesar ajuste de una combinación
// -------------------------------------------------------------
async function procesarAjuste({
    db,
    userId,
    did_producto,
    did_combinacion,
    cantidad,
    identificadores_especiales,
    did_deposito,
    did_cliente,
}) {
    // verificar producto
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

    // buscar combinación existente
    const stockActual = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: { did_producto_combinacion: did_combinacion },
    });

    let didUpdateResult;

    if (stockActual.length === 0) {
        // si no existe, se crea un nuevo registro con ese valor
        [didUpdateResult] = await LightdataORM.insert({
            db,
            table: "stock_producto",
            quien: userId,
            data: {
                did_producto,
                did_producto_combinacion: did_combinacion,
                stock_combinacion: Number(cantidad),
                stock_producto: Number(cantidad), // temporal, se recalcula luego
                did_deposito,
                tiene_ie: productoVerificacion.tiene_ie,
            },
        });
    } else {
        // si ya existe, reemplazar stock_combinacion directamente
        [didUpdateResult] = await LightdataORM.update({
            db,
            table: "stock_producto",
            quien: userId,
            data: { stock_combinacion: Number(cantidad) },
            where: { did: stockActual[0].did },
        });
    }

    // guardar identificadores especiales si aplica
    if (productoVerificacion.tiene_ie == 1) {
        const data_ie = (identificadores_especiales || []).reduce((acc, item) => {
            acc[item.did] = item.valor;
            return acc;
        }, {});

        const hash = createHash("sha256").update(JSON.stringify(data_ie)).digest("hex");

        await LightdataORM.insert({
            db,
            table: "stock_producto_detalle",
            quien: userId,
            data: {
                did_producto,
                did_producto_combinacion: did_combinacion,
                stock: cantidad, // el valor actualizado
                data_ie: JSON.stringify(data_ie),
                did_producto_variante_stock: didUpdateResult,
                hash,
            },
        });
    }

    const response = {
        did_cliente,
        did_producto,
        did_combinacion,
        cantidad_actualizada: cantidad,
    };

    return {
        success: true,
        message: "Stock ajustado correctamente",
        data: response,
    };
}
