import { CustomException, executeQuery } from "lightdata-tools";

export async function getCurvaById({ db, req }) {
    const didParam = req.params.curvaDid;
    const didCurva = Number(didParam);
    const q = `
      SELECT
        cu.did              AS curva_did,
        cu.nombre           AS curva_nombre,

        cat.did             AS categoria_did,
        cat.nombre          AS categoria_nombre,
        cat.did_variante    AS variante_did
        , cu.codigo         AS codigo
        , cu.habilitado     AS habilitado

      FROM curvas cu
      LEFT JOIN variantes_curvas vcu
        ON vcu.did_curva = cu.did
       AND vcu.elim = 0
       AND vcu.superado = 0
      LEFT JOIN variantes_categorias cat
        ON cat.did = vcu.did_categoria           -- usamos did_categoria
       AND cat.elim = 0
       AND cat.superado = 0
      WHERE cu.did = ?
        AND cu.elim = 0
        AND cu.superado = 0
    `;
    const rows = await executeQuery({ db, query: q, values: [didCurva] });

    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No se encontró una curva activa con el DID ${didCurva}`,
        });
    }

    const base = rows[0];
    const categorias = [];

    const catSeen = new Set();

    for (const r of rows) {
        if (r.categoria_did && !catSeen.has(r.categoria_did)) {

            categorias.push({
                did_variante: r.variante_did ?? null,
                did_categoria: r.categoria_did,

            });
            catSeen.add(r.categoria_did);
        }
    }

    const curva = {
        did: base.curva_did,
        nombre: base.curva_nombre,
        codigo: base.codigo,
        habilitado: base.habilitado,
        categorias,
    };

    return {
        success: true,
        message: "Curva obtenida correctamente",
        data: curva,
        meta: { timestamp: new Date().toISOString() },
    };
}
