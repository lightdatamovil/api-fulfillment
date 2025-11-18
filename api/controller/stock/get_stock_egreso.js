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

    // ----------------------------------------------------------
    // 🆕 1) Obtener IDs desde params o query, flexible para ambos
    // ----------------------------------------------------------
    let idsRaw = [];

    // a) Si viene por params: /stock/:did_producto
    if (req.params?.did_producto) {
        idsRaw.push(req.params.did_producto);
    }

    // b) Si viene por query: ?dids=1,2,3
    if (req.query?.dids) {
        if (Array.isArray(req.query.dids)) {
            // Caso: ?dids[]=1&dids[]=2
            idsRaw.push(...req.query.dids);
        } else {
            // Caso: ?dids=1,2,3 o ?dids=1
            idsRaw.push(...req.query.dids.split(","));
        }
    }

    // Validar que haya algo
    if (!idsRaw.length) {
        throw new Error("Debe enviar un ID por params o una lista en query 'dids'.");
    }

    // Limpiar y convertir a números
    const idsParsed = idsRaw
        .map(n => Number(String(n).trim()))
        .filter(n => !isNaN(n));

    if (!idsParsed.length) {
        throw new Error("Los IDs enviados no son válidos.");
    }


    // ----------------------------------------------------------
    // 2) Traer stock básico
    // ----------------------------------------------------------
    const stockProductos = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: {
            did_producto: idsParsed,
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

    // Crear estructura de salida por producto
    const resultadoFinal = {};
    for (const did of idsParsed) resultadoFinal[did] = [];


    // ----------------------------------------------------------
    // 3) Procesar cada stock_producto
    // ----------------------------------------------------------
    for (const item of stockProductos) {
        const tieneIE = item.tiene_ie == 1;

        // Caso SIN IE
        if (!tieneIE) {
            resultadoFinal[item.did_producto].push({
                did_producto_combinacion: item.did_producto_combinacion,
                did: item.did,
                cantidad: item.stock ?? 0,
                identificadores: [],
            });
            continue;
        }

        // Caso CON IE → traer detalles
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
            resultadoFinal[item.did_producto].push({
                did_producto_combinacion: item.did_producto_combinacion,
                did: item.did,
                cantidad: item.stock ?? 0,
                identificadores: [],
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

            const identificadores = [];
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

    // --------------------
    // 🆕 5) Normalizar salida
    // --------------------
    let dataFinal;

    if (idsParsed.length === 1) {
        // Si es un solo producto, devolver SOLO el array
        dataFinal = resultadoFinal[idsParsed[0]] || [];
    } else {
        // Si son varios, devolver agrupado por producto
        dataFinal = resultadoFinal;
    }

    return {
        success: true,
        message: "Stock detallado sin agrupación por depósito",
        data: dataFinal,
        totales,
        meta: buildMeta({ totalItems: stockProductos.length }),
    };

}
