import { LightdataORM } from "lightdata-tools";


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
    const didParam = req.params.did;
    const didCategoria = Number(didParam);
    const userId = Number(req.user.userId);

    await LightdataORM.select({
        dbConnection,
        table: "variantes_categorias",
        where: { did: didCategoria },
        throwIfNotExists: true,
    });

    const subcategorias = await LightdataORM.select({
        dbConnection,
        table: "variantes_subcategorias",
        where: { did_categoria: didCategoria },
    });

    const didsSubcategorias = subcategorias.map((s) => s.did);

    if (didsSubcategorias.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_subcategoria_valores",
            where: { did_subcategoria: didsSubcategorias },
            quien: userId,
        });
    }

    if (didsSubcategorias.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_subcategorias",
            where: { did: didsSubcategorias },
            quien: userId,
        });
    }

    await LightdataORM.delete({
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
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
