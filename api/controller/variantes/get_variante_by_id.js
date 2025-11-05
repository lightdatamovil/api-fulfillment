import { CustomException, executeQuery } from "lightdata-tools";

export async function getVarianteById({ db, req }) {
    const { varianteId } = req.params;
    const didVariante = Number(varianteId);

    if (!Number.isFinite(didVariante) || didVariante <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "El parámetro varianteId debe ser numérico y mayor que 0",
        });
    }

    const selectQuery = `
    SELECT
      v.did          AS variante_did,
      v.codigo       AS variante_codigo,
      v.nombre       AS variante_nombre,
    
      v.habilitado   AS variante_habilitado,
      v.orden        AS variante_orden,

      vc.did         AS categoria_did,
      vc.nombre      AS categoria_nombre,

      vcv.did        AS valor_did,
      vcv.nombre     AS valor_nombre,
      vcv.codigo     AS codigo_valor

    FROM variantes v
    LEFT JOIN variantes_categorias vc
      ON vc.did_variante = v.did
     AND vc.elim = 0
     AND vc.superado = 0
    LEFT JOIN variantes_categoria_valores vcv
      ON vcv.did_categoria = vc.did
     AND vcv.elim = 0
     AND vcv.superado = 0

    WHERE v.elim = 0
      AND v.superado = 0
      AND v.did = ?

    ORDER BY vc.did ASC, vcv.did ASC
  `;

    const rows = await executeQuery({ db, query: selectQuery, values: [didVariante] });

    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "Variante no encontrada",
            message: `No se encontró una variante activa con el DID ${didVariante}`,
        });
    }

    const first = rows[0];
    const resultado = {
        did: first.variante_did,
        codigo: first.variante_codigo,
        nombre: first.variante_nombre,

        habilitado: first.variante_habilitado,
        orden: first.variante_orden,
        categorias: [],
    };

    const catMap = new Map();

    for (const r of rows) {
        if (r.categoria_did) {
            if (!catMap.has(r.categoria_did)) {
                catMap.set(r.categoria_did, {
                    did: r.categoria_did,
                    nombre: r.categoria_nombre,
                    valores: [],
                });
            }
            if (r.valor_did) {
                catMap.get(r.categoria_did).valores.push({
                    did: r.valor_did,
                    nombre: r.valor_nombre,
                    codigo: r.codigo_valor,
                });
            }
        }
    }

    resultado.categorias = Array.from(catMap.values());

    return {
        success: true,
        message: "Variante obtenida correctamente",
        data: resultado,
        meta: { timestamp: new Date().toISOString() },
    };
}
