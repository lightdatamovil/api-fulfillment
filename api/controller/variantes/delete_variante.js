import { CustomException, LightdataQuerys, Status } from "lightdata-tools";


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
    const userId = Number(req.user?.userId ?? req.user?.id ?? 0) || null;

    if (!Number.isFinite(didCategoria) || didCategoria <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "Se requiere un 'did' de categoría numérico válido",
            status: Status.badRequest,
        });
    }

    const categoria = await LightdataQuerys.select({
        dbConnection,
        table: "variantes_categorias",
        column: "did",
        value: didCategoria,
        throwExceptionIfNotExists: true,
    });

    if (Number(categoria[0].elim) === 1) {
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

    const subcategorias = await LightdataQuerys.select({
        dbConnection,
        table: "variantes_subcategorias",
        column: "did_categoria",
        value: didCategoria,
    });

    const didsSubcategorias = subcategorias.map((s) => s.did);

    let affectedValores = 0;
    if (didsSubcategorias.length > 0) {
        await LightdataQuerys.delete({
            dbConnection,
            table: "variantes_subcategoria_valores",
            did: didsSubcategorias,
            quien: userId,
        });
        affectedValores = didsSubcategorias.length;
    }

    let affectedSubcats = 0;
    if (didsSubcategorias.length > 0) {
        await LightdataQuerys.delete({
            dbConnection,
            table: "variantes_subcategorias",
            did: didsSubcategorias,
            quien: userId,
        });
        affectedSubcats = didsSubcategorias.length;
    }

    await LightdataQuerys.delete({
        dbConnection,
        table: "variantes_categorias",
        did: didCategoria,
        quien: userId,
    });

    return {
        success: true,
        message: "Categoría de variantes eliminada correctamente",
        data: {
            did: didCategoria,
            affected: {
                categoria: 1,
                subcategorias: affectedSubcats,
                valores: affectedValores,
            },
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
