import { CustomException, executeQuery } from "lightdata-tools";

/**
 * Trae una curva por DID con sus categorías asociadas (activas).
 * Param: req.params.id (o varianteId) — usamos :did
 * Respuesta:
 * {
 *   did, nombre, categorias: [{ did }]
 * }
 */
export async function getCurvaById(dbConnection, req) {
    const didParam = req.params?.did ?? req.params?.id ?? req.params?.varianteId;
    const didCurva = Number(didParam);

    if (!Number.isFinite(didCurva) || didCurva <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "El parámetro did debe ser numérico y mayor que 0",
        });
    }

    const rows = await executeQuery(
        dbConnection,
        `
      SELECT
        vc.did             AS curva_did,
        vc.nombre          AS curva_nombre,
        vcc.did_variante  AS cat_did
      FROM curvas vc
      LEFT JOIN variantes_curvas vcc
        ON vcc.did_curva = vc.did
       AND vcc.elim = 0
       AND vcc.superado = 0
      WHERE vc.did = ?
        AND vc.elim = 0
        AND vc.superado = 0
    `,
        [didCurva]
    );

    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No se encontró una curva activa con el DID ${didCurva}`,
        });
    }

    const curva = {
        did: rows[0].curva_did,
        nombre: rows[0].curva_nombre,
        categorias: [],
    };

    for (const r of rows) {
        if (r.cat_did) {
            curva.categorias.push({ did: r.cat_did });
        }
    }

    return {
        success: true,
        message: "Curva obtenida correctamente",
        data: curva,
        meta: { timestamp: new Date().toISOString() },
    };
}
