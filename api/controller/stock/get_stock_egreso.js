import { LightdataORM } from "lightdata-tools";
import { buildMeta } from "../../src/functions/query_utils.js";

async function getIdentificadoresMap(db) {
    const ies = await LightdataORM.select({
        db,
        table: "identificadores_especiales",
        where: { elim: 0, superado: 0 },
        select: ["did", "nombre"],
    });

    const mapa = {};
    for (const ie of ies) mapa[ie.did] = ie.nombre;
    return mapa;
}

export async function getStockActualIE({ db, req }) {
    const didProductoParam = req.params?.did_producto;
    const didProducto = Number(didProductoParam);

    if (!didProducto || Number.isNaN(didProducto)) {
        throw new Error("Parámetro 'did_producto' inválido o ausente");
    }

    const stockProductos = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: { did_producto: didProducto, elim: 0, superado: 0 },
    });

    if (!stockProductos.length) {
        return {
            success: true,
            message: "No se encontró stock para el producto indicado",
            data: [],
            meta: buildMeta({ totalItems: 0 }),
        };
    }

    const tieneIE = stockProductos.some((s) => s.tiene_ie == 1);

    // 🩵 Caso SIN IE → NO AGRUPAMOS POR DEPÓSITO MÁS
    if (!tieneIE) {
        const resultado = [];

        for (const item of stockProductos) {
            resultado.push({
                did_producto_combinacion: item.did_producto_combinacion,
                cantidad: item.stock ?? 0,
            });
        }

        const totalGeneral = resultado.reduce((sum, i) => sum + i.cantidad, 0);

        return {
            success: true,
            message: "Stock sin IE",
            data: resultado,
            total: totalGeneral,
            meta: buildMeta({ totalItems: resultado.length }),
        };
    }

    // 💛 Caso CON IE → también sin agrupación por depósito
    const resultado = [];

    for (const item of stockProductos) {
        const detalles = await LightdataORM.select({
            db,
            table: "stock_producto_detalle",
            where: {
                did_producto: item.did_producto,
                did_producto_combinacion: item.did_producto_combinacion,
                did_producto_variante_stock: item.did,
                elim: 0,
                superado: 0,
            },
            select: ["id", "did", "data_ie", "stock"],
        });

        if (!detalles.length) {
            resultado.push({
                did_producto_combinacion: item.did_producto_combinacion,
                did: item.did,                 // 🔥 CAMBIO
                identificadores: {},
                stock: item.stock ?? 0,
            });
            continue;
        }

        for (const det of detalles) {
            let dataIE;
            try {
                const fixed = det.data_ie.replace(/(\w+):/g, '"$1":');
                dataIE = JSON.parse(fixed);
            } catch {
                console.warn("Error parseando data_ie:", det.data_ie);
                dataIE = {};
            }

            // 🔥 CAMBIO → devolver { did_ie: valor }
            const identificadores = [];
            for (const [did_ie, valor] of Object.entries(dataIE)) {
                identificadores[did_ie] = valor;
            }

            resultado.push({
                did_producto_combinacion: item.did_producto_combinacion,
                did: det.did,                 // 🔥 CAMBIO: ahora es "did"
                identificadores,
                cantidad: det.stock ?? 0,
            });
        }
    }

    const totalGeneral = resultado.reduce((sum, i) => sum + i.cantidad, 0);

    return {
        success: true,
        message: "Stock detallado sin agrupación por depósito",
        data: resultado,
        total: totalGeneral,
        meta: buildMeta({ totalItems: resultado.length }),
    };
}
