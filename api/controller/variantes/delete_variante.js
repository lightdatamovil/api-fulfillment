import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Elimina (soft-delete) una categoría de variantes por DID.
 * Marca elim = 1 en:
 *  - variantes_categorias (did = ?)
 *  - variantes_subcategorias (did_categoria = ?)
 *  - variantes_subcategoria_valores (did_subcategoria IN (subcats de esa categoría))
 *
 * Entrada aceptada:
 *  - req.params.did
 *  - o req.body.did_categoria / req.body.didCategoria / req.body.did
 */
export async function deleteVarianteCategoria(dbConnection, req) {
    const didParam =
        req.params?.did ??
        req.body?.did_categoria ??
        req.body?.didCategoria ??
        req.body?.did;

    const didCategoria = Number(didParam);
    if (!Number.isFinite(didCategoria) || didCategoria <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "Se requiere un 'did' de categoría numérico válido",
            status: Status.badRequest,
        });
    }

    // ¿Existe la categoría?
    const qCat = `
    SELECT id, did, elim
    FROM variantes_categorias
    WHERE did = ?
    LIMIT 1
  `;
    const cat = await executeQuery(dbConnection, qCat, [didCategoria]);

    if (!cat || cat.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No existe la categoría con did ${didCategoria}`,
            status: Status.notFound,
        });
    }

    // Si ya estaba eliminada, respondemos idempotente
    if (Number(cat[0].elim) === 1) {
        return {
            success: true,
            message: "La categoría ya estaba eliminada",
            data: {
                did: didCategoria,
                affected: { categoria: 0, subcategorias: 0, valores: 0 },
            },
            meta: { timestamp: new Date().toISOString() },
        };
    }

    // 1) Eliminar valores de subcategorías de esta categoría
    // Usamos subquery para obtener los did de subcategorías
    const delValsSql = `
    UPDATE variantes_subcategoria_valores
    SET elim = 1
    WHERE did_subcategoria IN (
      SELECT did FROM variantes_subcategorias WHERE did_categoria = ?
    )
  `;
    const updVals = await executeQuery(dbConnection, delValsSql, [didCategoria]);

    // 2) Eliminar subcategorías de esta categoría
    const delSubSql = `
    UPDATE variantes_subcategorias
    SET elim = 1
    WHERE did_categoria = ?
  `;
    const updSub = await executeQuery(dbConnection, delSubSql, [didCategoria]);

    // 3) Eliminar la categoría
    const delCatSql = `
    UPDATE variantes_categorias
    SET elim = 1
    WHERE did = ?
  `;
    const updCat = await executeQuery(dbConnection, delCatSql, [didCategoria]);

    return {
        success: true,
        message: "Categoría de variantes eliminada correctamente",
        data: {
            did: didCategoria,
            affected: {
                categoria: updCat?.affectedRows ?? 0,
                subcategorias: updSub?.affectedRows ?? 0,
                valores: updVals?.affectedRows ?? 0,
            },
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
