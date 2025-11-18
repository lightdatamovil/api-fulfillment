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

    // ------------------------------
    // 🆕 1) Recibir DIDs desde query: ?dids=123,456,789
    // ------------------------------
    const didsQuery = req.query?.dids;

    if (!didsQuery || typeof didsQuery !== "string") {
        throw new Error("Debe enviar una query 'dids' con IDs separados por comas. Ej: ?dids=123,456");
    }

    // Convertir string → array → números
    const idsParsed = didsQuery
        .split(",")
        .map(n => Number(n.trim()))
        .filter(n => !isNaN(n));

    if (!idsParsed.length) {
        throw new Error("La query 'dids' no contiene valores numéricos válidos.");
    }

    // -------------------------------------------------
    // 2) Obtener stock de TODOS los did_producto recibidos
    // -------------------------------------------------
    const stockProductos = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: {
            did_producto: idsParsed,   // Soporta array = IN(...)
            elim: 0,
            superado: 0,
        },
    });

    if (!stockProductos.length) {
        return {
            success: true,
            message: "No se encontró stock para los productos solicitados",
            data: {},
            totales: {},
            meta: buildMeta({ totalItems: 0 }),
        };
    }

    // Preparar estructura final por producto
    const resultadoFinal = {};
    for (const did of idsParsed) resultadoFinal[did] = [];

    // -------------------------------------
    // 3) Procesar cada entrada del stock base
    // -------------------------------------
    for (const item of stockProductos) {

        const tieneIE = item.tiene_ie == 1;

        // SIN identificadores especiales
        if (!tieneIE) {
            resultadoFinal[item.did_producto].push({
                did_producto_combinacion: item.did_producto_combinacion,
                did: item.did,
                cantidad: item.stock ?? 0,
                identificadores: {},
            });
            continue;
        }

        // CON identificadores especiales → traer detalles
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
            // Si no hay detalles, se devuelve igual
            resultadoFinal[item.did_producto].push({
                did_producto_combinacion: item.did_producto_combinacion,
                did: item.did,
                identificadores: {},
                cantidad: item.stock ?? 0,
            });
            continue;
        }

        // Procesar cada detalle
        for (const det of detalles) {
            let dataIE;

            try {
                const fixed = det.data_ie.replace(/(\w+):/g, '"$1":');
                dataIE = JSON.parse(fixed);
            } catch {
                console.warn("Error parseando data_ie:", det.data_ie);
                dataIE = {};
            }

            const identificadores = {};
            for (const [did_ie, valor] of Object.entries(dataIE)) {
                identificadores[did_ie] = valor;
            }

            resultadoFinal[item.did_producto].push({
                did_producto_combinacion: item.did_producto_combinacion,
                did: det.did,
                identificadores,
                cantidad: det.stock ?? 0,
            });
        }
    }

    // --------------------
    // 4) Calcular totales
    // --------------------
    const totales = {};
    for (const did of idsParsed) {
        totales[did] = resultadoFinal[did].reduce((s, i) => s + i.cantidad, 0);
    }

    return {
        success: true,
        message: "Stock detallado sin agrupación por depósito",
        data: resultadoFinal,
        totales,
        meta: buildMeta({ totalItems: stockProductos.length }),
    };
}
