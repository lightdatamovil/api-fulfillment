import { createHash } from "crypto";
import { CustomException, LightdataORM } from "lightdata-tools";
import { createRemito } from "../remito/create_remito.js";

export async function egresoStock({ db, req }) {
    const { did_cliente, productos, did_deposito, observacion, fecha } = req.body;
    const userId = Number(req.user.userId);

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Debes enviar al menos un producto con sus combinaciones."
        });
    }

    const resultados = [];
    const remito_dids = [];

    for (const producto of productos) {
        const { did_producto, combinaciones } = producto;

        if (!combinaciones || combinaciones.length === 0) {
            throw new CustomException({
                title: "Combinaciones requeridas",
                message: `El producto ${did_producto} no tiene combinaciones para procesar.`,
            });
        }

        for (const combinacion of combinaciones) {
            const { did_combinacion, cantidad, identificadores_especiales } = combinacion;

            const resultado = await procesarEgreso({
                db,
                userId,
                did_producto,
                did_combinacion,
                cantidad,
                identificadores_especiales,
                did_deposito,
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
        accion: "RETIRO", // 👈 cambia respecto a ingreso
        remito_dids,
        fecha
    };

    await createRemito({ db, ...remitoBody });

    return {
        success: true,
        message: "Egreso de stock realizado correctamente y remito generado.",
        data: resultados,
        meta: { timestamp: new Date().toISOString() }
    };
}

// -----------------------------------------------------------------------------
// Lógica interna reutilizable
// -----------------------------------------------------------------------------
async function procesarEgreso({
    db,
    userId,
    did_producto,
    did_combinacion,
    cantidad,
    identificadores_especiales,
    did_deposito,
    did_cliente
}) {
    // 1️⃣ Verificar existencia del producto
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

    // 2️⃣ Verificar stock actual
    const stockActual = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: { did_producto_combinacion: did_combinacion },
    });

    if (stockActual.length === 0) {
        throw new CustomException({
            title: "Stock inexistente",
            message: `No hay stock registrado para la combinación ${did_combinacion}.`,
        });
    }

    const stockCombinacionActual = Number(stockActual[0].stock_combinacion || 0);
    const stockProductoActual = Number(stockActual[0].stock_producto || 0);

    // Control de stock insuficiente
    if (stockCombinacionActual < cantidad) {
        throw new CustomException({
            title: "Stock insuficiente",
            message: `Intentas egresar ${cantidad} unidades pero solo hay ${stockCombinacionActual}.`,
        });
    }

    // 3️⃣ Calcular nuevas cantidades
    const nuevaCantidadCombinacion = stockCombinacionActual - Number(cantidad);
    const nuevaCantidadProducto = stockProductoActual - Number(cantidad);

    // 4️⃣ Actualizar tabla principal de stock
    const [didUpdateResult] = await LightdataORM.update({
        db,
        table: "stock_producto",
        quien: userId,
        data: {
            stock_combinacion: nuevaCantidadCombinacion,
            stock_producto: nuevaCantidadProducto,
            did_deposito
        },
        where: { did: stockActual[0].did },
    });

    // 5️⃣ Si tiene identificadores especiales
    if (productoVerificacion.tiene_ie == 1) {
        if (!Array.isArray(identificadores_especiales) || identificadores_especiales.length === 0) {
            throw new CustomException({
                title: "Identificadores especiales requeridos",
                message: `El producto ${did_producto} requiere identificadores especiales.`,
            });
        }

        // Crear JSON y hash
        const data_ie = identificadores_especiales.reduce((acc, item) => {
            acc[item.did] = item.valor;
            return acc;
        }, {});

        const hash = createHash("sha256").update(JSON.stringify(data_ie)).digest("hex");

        // 6️⃣ Registrar detalle (movimiento negativo)
        const stock_detalle = {
            did_producto,
            did_producto_combinacion: did_combinacion,
            stock: -Math.abs(Number(cantidad)), // 👈 egreso negativo
            data_ie: JSON.stringify(data_ie),
            did_producto_variante_stock: didUpdateResult,
            hash,
            fecha_movimiento: new Date(),
        };

        await LightdataORM.insert({
            db,
            table: "stock_producto_detalle",
            quien: userId,
            data: stock_detalle,
        });
    }

    // 7️⃣ Respuesta estructurada
    const response = {
        did_cliente,
        did_producto,
        did_combinacion,
        cantidad_egresada: cantidad,
        stock_actual_producto: nuevaCantidadProducto,
        stock_actual_combinacion: nuevaCantidadCombinacion
    };

    return {
        success: true,
        message: "Egreso de stock procesado correctamente",
        data: response,
    };
}