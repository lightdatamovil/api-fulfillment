import { CustomException, executeQuery } from "lightdata-tools";

export async function getVarianteById(dbConnection, req) {
    const { varianteId } = req.params; // es el DID de la categoría
    const didCategoria = Number(varianteId);

    if (!Number.isFinite(didCategoria) || didCategoria <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "El parámetro varianteId debe ser numérico y mayor que 0",
        });
    }

    const selectQuery = `
    SELECT
      vc.did                AS categoria_did,
      vc.nombre             AS categoria_nombre,
      vc.codigo             AS categoria_codigo,
      vc.descripcion        AS categoria_descripcion,
      vc.habilitado         AS categoria_habilitado,
      vc.orden              AS categoria_orden,

      vs.did                AS sub_did,

      vsv.did               AS valor_did,
      vsv.nombre            AS valor_nombre

    FROM variantes_categorias vc
    LEFT JOIN variantes_subcategorias vs
      ON vs.did_categoria = vc.did
     AND vs.elim = 0
     AND vs.superado = 0
    LEFT JOIN variantes_subcategoria_valores vsv
      ON vsv.did_subcategoria = vs.did
     AND vsv.elim = 0
     AND vsv.superado = 0

    WHERE vc.elim = 0
      AND vc.superado = 0
      AND vc.did = ?

    ORDER BY vs.did ASC, vsv.did ASC
  `;

    const rows = await executeQuery(dbConnection, selectQuery, [didCategoria]);

    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "Categoría no encontrada",
            message: `No se encontró una categoría activa con el DID ${didCategoria}`,
        });
    }

    const first = rows[0];
    const resultado = {
        did: first.categoria_did,
        nombre: first.categoria_nombre,
        codigo: first.categoria_codigo,
        descripcion: first.categoria_descripcion,
        habilitado: first.categoria_habilitado,
        orden: first.categoria_orden,
        subcategorias: [],
    };

    // Agrupar subcategorías y sus valores
    const subMap = new Map(); // didSubcategoria -> { did, valores: [] }

    for (const r of rows) {
        if (r.sub_did) {
            if (!subMap.has(r.sub_did)) {
                subMap.set(r.sub_did, {
                    did: r.sub_did,
                    valores: [],
                });
            }
            if (r.valor_did) {
                subMap.get(r.sub_did).valores.push({
                    did: r.valor_did,
                    nombre: r.valor_nombre,
                });
            }
        }
    }

    resultado.subcategorias = Array.from(subMap.values());

    return {
        success: true,
        message: "Categoría de variantes obtenida correctamente",
        data: resultado,
        meta: { timestamp: new Date().toISOString() },
    };
}
