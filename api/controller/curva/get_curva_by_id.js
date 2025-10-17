import { CustomException, executeQuery } from "lightdata-tools";

/**
 * GET /curvas/:curvaDid
 * Respuesta:
 * {
 *   did: number,
 *   nombre: string,
 *   categorias: Array<{
 *     did: number,
 *     nombre: string | null,
 *     did_variante: number | null
 *   }>
 * }
 */
export async function getCurvaById(dbConnection, req) {
    const didParam = req.params.curvaDid;
    const didCurva = Number(didParam);

    if (!Number.isFinite(didCurva) || didCurva <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "El parámetro curvaDid debe ser numérico y mayor que 0",
        });
    }

    // Curva → (pivot) variantes_curvas.did_categoria → variantes_categorias (para traer did_variante)
    const rows = await executeQuery(
        dbConnection,
        `
      SELECT
        cu.did              AS curva_did,
        cu.nombre           AS curva_nombre,

        cat.did             AS categoria_did,
        cat.nombre          AS categoria_nombre,
        cat.did_variante    AS variante_did

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
    `,
        [didCurva]
    );

    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No se encontró una curva activa con el DID ${didCurva}`,
        });
    }

    // Base de la curva (la LEFT JOIN garantiza al menos una fila si la curva existe)
    const base = rows[0];
    const variantes = [];

    // Evitar duplicados por si hay múltiples filas por categoría
    const catSeen = new Set();

    for (const r of rows) {
        if (r.categoria_did && !catSeen.has(r.categoria_did)) {
            variantes.push({
                did_variante: r.variante_did ?? null,
                did_categoria: r.categoria_did,

            });
            catSeen.add(r.categoria_did);
        }
    }

    const curva = {
        did: base.curva_did,
        nombre: base.curva_nombre,
        variantes, // [] si no hay categorías activas
    };

    return {
        success: true,
        message: "Curva obtenida correctamente",
        data: curva,
        meta: { timestamp: new Date().toISOString() },
    };
}
