import { LightdataORM } from "lightdata-tools";
import { buildMeta } from "../../src/functions/query_utils.js";

export async function getStockActualbyProducto({ db, req }) {
    const { did_producto, did_variante_valor } = req.params;
    const didProducto = Number(did_producto);
    const didVarianteValor = did_variante_valor ? Number(did_variante_valor) : null;

    // 1️⃣ Obtener todos los registros de stock del producto
    const stockBase = await LightdataORM.select({
        db,
        table: "stock_producto",
        where: { did_producto: didProducto, elim: 0, superado: 0 },
    });

    if (!stockBase.length) {
        throw new Error("No se encontró stock para el producto indicado");
    }

    // Si vino una combinación, filtramos por ella
    const stockFiltrado = didVarianteValor
        ? stockBase.filter((x) => x.did_producto_combinacion === didVarianteValor)
        : stockBase;

    // Si no hay registros filtrados
    if (!stockFiltrado.length) {
        return {
            success: true,
            message: "No hay stock para la combinación solicitada",
            data: [],
            meta: buildMeta({ totalItems: 0 }),
        };
    }

    // 2️⃣ Verificar si el producto usa identificadores especiales (IE)
    const tieneIE = stockFiltrado[0].tiene_ie === 1;

    if (!tieneIE) {
        // Agrupar stock por combinación
        const grouped = Object.values(
            stockFiltrado.reduce((acc, item) => {
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

    // 3️⃣ Si tiene IE, traemos detalles por cada combinación
    const detalles = [];
    for (const item of stockFiltrado) {
        const detalle = await LightdataORM.select({
            db,
            table: "stock_producto_detalle",
            where: {
                did_producto_variante_stock: item.id,
                elim: 0,
                superado: 0,
            },
            select: ["id", "data_ie", "cant"],
        });

        // Parseamos data_ie (puede venir como string)
        const detallesParseados = detalle.map((d) => {
            let dataIE;
            try {
                dataIE = JSON.parse(d.data_ie);
            } catch {
                dataIE = {};
            }
            return {
                id: d.id,
                data_ie: dataIE,
                cantidad: d.cant,
                did_producto_variante_stock: item.id,
                did_producto_combinacion: item.did_producto_combinacion,
            };
        });

        detalles.push(...detallesParseados);
    }

    return {
        success: true,
        message: "Stock detallado por ítem individual (IE)",
        data: detalles,
        meta: buildMeta({ totalItems: detalles.length }),
    };
}
