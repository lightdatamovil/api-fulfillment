import { executeQuery } from "lightdata-tools";

export async function informeStock({ db, req }) {
    const { did_cliente } = req.params;
    const q = `
    SELECT 
      p.*, 
      pvv.did AS did_productos_variantes_valores,
      pvv.valores AS valores_raw,
  
      -- 🔹 Stock de la combinación (sumado desde el detalle)
      (
        SELECT COALESCE(SUM(spd.stock), 0)
        FROM stock_producto_detalle AS spd
        JOIN stock_producto AS sp
          ON spd.did_producto_variante_stock = sp.did
        WHERE sp.did_producto_combinacion = pvv.did
          AND sp.elim = 0
          AND sp.superado = 0
          -- Si stock_producto_detalle es versionado, descomentá:
          -- AND spd.elim = 0
          -- AND spd.superado = 0
      ) AS stock_combinacion
  
    FROM productos AS p
    LEFT JOIN productos_variantes_valores AS pvv
      ON p.did = pvv.did_producto
    WHERE p.elim = 0
      AND p.superado = 0 AND p.did_cliente = ?
    ORDER BY p.did DESC;
  `;

    const rows = await executeQuery({ db, query: q, values: [did_cliente] });
    const productosMap = rows.reduce((acc, row) => {
        if (!acc[row.did]) {
            acc[row.did] = {
                ...row,
                valores: [],
                insumos: [],
                stock_producto: 0, // lo calculamos después
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