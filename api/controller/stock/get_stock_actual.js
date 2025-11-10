import { LightdataORM } from "lightdata-tools";
import { buildMeta } from "../../src/functions/query_utils.js";

// 🧩 Obtener mapa de identificadores especiales (did → nombre)
async function getIdentificadoresMap(db) {
    const ies = await LightdataORM.select({
        db,
        table: "identificadores_especiales",
        where: { elim: 0, superado: 0 },
        select: ["did", "nombre"],
    });

    const mapa = {};
    for (const ie of ies) {
        mapa[ie.did] = ie.nombre;
    }
    return mapa;
}

// 📦 Función principal
export async function getStockActualbyProducto({ db, req }) {
    const didProductoParam = req.params?.did_producto;
    const didProducto = Number(didProductoParam);

    // 🔒 Validación
    if (!didProducto || Number.isNaN(didProducto)) {
        throw new Error("Parámetro 'did_producto' inválido o ausente");
    }

    // 📦 Buscar registros de stock del producto
    const stockProductos = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: { did_producto: didProducto, elim: 0, superado: 0 },
    });

    if (!stockProductos.length) {
        return {
            success: true,
            message: "No se encontró stock para el producto indicado",
            data: {},
            meta: buildMeta({ totalItems: 0 }),
        };
    }

    // Detectar si alguno tiene identificadores especiales (IE)
    const tieneIE = stockProductos.some((s) => s.tiene_ie == 1);

    // 🩵 Caso SIN IE → agrupar por depósito y combinación
    if (!tieneIE) {
        const agrupadoPorDeposito = stockProductos.reduce((acc, item) => {
            const key = item.did_deposito ? String(item.did_deposito) : "sin_deposito";
            if (!acc[key]) acc[key] = [];

            const existente = acc[key].find(
                (c) => c.did_producto_combinacion === item.did_producto_combinacion
            );

            if (existente) {
                existente.cantidad += item.stock ?? 0;
            } else {
                acc[key].push({
                    did_producto_combinacion: item.did_producto_combinacion,
                    cantidad: item.stock ?? 0,
                });
            }

            return acc;
        }, {});

        const totalGeneral = Object.values(agrupadoPorDeposito)
            .flat()
            .reduce((sum, i) => sum + i.cantidad, 0);

        return {
            success: true,
            message: "Stock agrupado por depósito y combinación",
            data: agrupadoPorDeposito,
            total: totalGeneral,
            meta: buildMeta({ totalItems: Object.keys(agrupadoPorDeposito).length }),
        };
    }

    // 💛 Caso CON IE → buscar detalles
    const mapaIE = await getIdentificadoresMap(db);
    const resultado = [];

    for (const item of stockProductos) {
        const detalles = await LightdataORM.select({
            db,
            table: "stock_producto_detalle",
            where: {
                did_producto: item.did_producto,
                did_producto_variante: item.did_producto_combinacion,
                did_producto_variante_stock: item.did,
                elim: 0,
                superado: 0,
            },
            select: ["id", "data_ie", "stock"],
        });

        // Fallback si no hay detalles
        if (!detalles.length) {
            resultado.push({
                did_deposito: item.did_deposito,
                did_producto: item.did_producto,
                did_producto_combinacion: item.did_producto_combinacion,
                identificadores: {},
                cantidad: item.stock ?? 0,
            });
            continue;
        }

        const detalleAgrupado = detalles.reduce((acc, det) => {
            let dataIE;
            try {
                // Repara el formato si viene sin comillas (ej: {1:22} → {"1":22})
                const fixed = det.data_ie.replace(/(\w+):/g, '"$1":');
                dataIE = JSON.parse(fixed);
            } catch {
                console.warn("Error parseando data_ie:", det.data_ie);
                dataIE = {};
            }

            const dataIEReadable = {};
            for (const [k, v] of Object.entries(dataIE)) {
                const nombre = mapaIE[k] || `Identificador ${k}`;
                dataIEReadable[nombre] = v;
            }

            const claveIE = Object.entries(dataIEReadable)
                .map(([k, v]) => `${k}:${v}`)
                .join("|");

            if (!acc[claveIE]) {
                acc[claveIE] = {
                    did_deposito: item.did_deposito,
                    did_producto: item.did_producto,
                    did_producto_combinacion: item.did_producto_combinacion,
                    identificadores: dataIEReadable,
                    cantidad: 0,
                };
            }

            acc[claveIE].cantidad += det.stock ?? 0;
            return acc;
        }, {});

        resultado.push(...Object.values(detalleAgrupado));
    }

    // 🔹 Agrupar todo el resultado en arrays por depósito
    const agrupadoPorDeposito = resultado.reduce((acc, item) => {
        const key = item.did_deposito ? String(item.did_deposito) : "sin_deposito";
        if (!acc[key]) acc[key] = [];

        const existente = acc[key].find(
            (c) => c.did_producto_combinacion === item.did_producto_combinacion
        );

        if (existente) {
            existente.cantidad += item.cantidad ?? 0;
        } else {
            acc[key].push({
                did_producto_combinacion: item.did_producto_combinacion,
                identificadores: item.identificadores,
                cantidad: item.cantidad ?? 0,
            });
        }

        return acc;
    }, {});

    const totalGeneral = Object.values(agrupadoPorDeposito)
        .flat()
        .reduce((sum, i) => sum + i.cantidad, 0);

    return {
        success: true,
        message: "Stock detallado agrupado por depósito e identificador especial (IE)",
        data: agrupadoPorDeposito,
        total: totalGeneral,
        meta: buildMeta({ totalItems: Object.keys(agrupadoPorDeposito).length }),
    };
}
