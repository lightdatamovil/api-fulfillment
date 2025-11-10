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
            data: [],
            meta: buildMeta({ totalItems: 0 }),
        };
    }

    // Detectar si alguno tiene identificadores especiales (IE)
    const tieneIE = stockProductos.some((s) => s.tiene_ie == 1);

    // 🩵 Caso SIN IE → agrupar por combinación
    if (!tieneIE) {
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

        const totalGeneral = grouped.reduce((sum, i) => sum + i.cantidad, 0);

        return {
            success: true,
            message: "Stock agrupado por combinación",
            data: grouped,
            total: totalGeneral,
            meta: buildMeta({ totalItems: grouped.length }),
        };
    }

    // 💛 Caso CON IE → buscar detalles
    const mapaIE = await getIdentificadoresMap(db);
    const resultado = [];

    for (const item of stockProductos) {
        console.log(stockProductos);

        const detalles = await LightdataORM.select({
            db,
            table: "stock_producto_detalle",
            where: {
                did_producto: item.did_producto, // mismo producto
                did_producto_variante: item.did_producto_combinacion, // misma combinación
                did_producto_variante_stock: item.did, // referencia correcta al stock padre
                elim: 0,
                superado: 0,
            },
            select: ["id", "data_ie", "stock"],

        });
        console.log("didProducto", item.did_producto);
        console.log("did_producto_combinacion", item.did_producto_combinacion);
        console.log("did_producto_variante_stock", item.did);



        // Fallback si no hay detalles
        if (!detalles.length) {



            resultado.push({
                did_producto: item.did_producto,
                did_producto_combinacion: item.did_producto_combinacion,
                identificadores: {},
                cantidad: item.stock ?? 0,
            });
            continue;
        }

        console.log(detalles);

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



            console.log(dataIE);
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

    const totalGeneral = resultado.reduce((sum, i) => sum + i.cantidad, 0);

    return {
        success: true,
        message: "Stock detallado por combinación e identificador especial (IE)",
        data: resultado,
        total: totalGeneral,
        meta: buildMeta({ totalItems: resultado.length }),
    };
}
