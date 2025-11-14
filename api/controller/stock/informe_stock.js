import { executeQuery } from "lightdata-tools";
import { SqlWhere } from "../../src/functions/query_utils.js";

export async function informeStock({ db, req }) {
    const { did_cliente } = req.params;
    const { sku, ean, descripcion } = req.query || {};

    // 🔹 Armamos el WHERE dinámico
    const where = new SqlWhere()
        .eq("p.elim", 0)
        .eq("p.superado", 0)
        .eq("p.did_cliente", did_cliente)
        .likeCI("p.sku", sku)              // filtro por SKU (contiene, case-insensitive)
        .likeCI("p.ean", ean)              // filtro por EAN
        .likeCI("p.descripcion", descripcion); // filtro por descripción

    const { whereSql, params } = where.finalize();

    const q = `
      SELECT 
        p.*, 
        pvv.did AS did_productos_variantes_valores,
        pvv.valores AS valores_raw,
        (
          SELECT COALESCE(SUM(spd.stock), 0)
          FROM stock_producto_detalle AS spd
          JOIN stock_producto AS sp
            ON spd.did_producto_variante_stock = sp.did
           AND spd.elim = 0 AND spd.superado = 0
          WHERE sp.did_producto_combinacion = pvv.did
            AND sp.elim = 0
            AND sp.superado = 0
        ) AS stock_combinacion
      FROM productos AS p
      LEFT JOIN productos_variantes_valores AS pvv
        ON p.did = pvv.did_producto
      ${whereSql}
      ORDER BY p.did DESC;
    `;

    const rows = await executeQuery({ db, query: q, values: params });

    const productosMap = rows.reduce((acc, row) => {
        if (!acc[row.did]) {
            acc[row.did] = {
                ...row,
                valores: [],
                insumos: [],
                stock_producto: 0,
            };
        }

        if (row.did_productos_variantes_valores) {
            acc[row.did].valores.push({
                did_productos_variantes_valores: row.did_productos_variantes_valores,
                valores: row.valores_raw
                    ? row.valores_raw.split(",").map(v => Number(v.trim()))
                    : [],
                stock_combinacion: Number(row.stock_combinacion) || 0,
            });
        }

        // Limpio campos "internos" que ya procesamos
        delete acc[row.did].did_productos_variantes_valores;
        delete acc[row.did].valores_raw;
        delete acc[row.did].stock_combinacion;

        return acc;
    }, {});

    const productos = Object.values(productosMap).map(p => {
        // Normalizo dids_ie
        p.dids_ie =
            p.dids_ie == null || p.dids_ie === ""
                ? []
                : p.dids_ie.split(",").map(did => Number(did.trim()));

        p.stock_producto = p.valores.reduce(
            (sum, v) => sum + (v.stock_combinacion || 0),
            0
        );

        return p;
    });

    return productos;
}
