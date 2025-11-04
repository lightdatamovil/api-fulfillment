import { LightdataORM } from "lightdata-tools";

export async function deleteVariante(db, req) {
    const { did } = req.params;
    const userId = Number(req.user?.userId ?? req.user?.id ?? 0) || null;

    await LightdataORM.select({
        db,
        table: "variantes",
        where: { did: did },
        throwIfNotExists: true,
    });

    await LightdataORM.delete({
        db,
        table: "variantes",
        where: { did: did },
        quien: userId,
    });

    const categorias = await LightdataORM.select({
        db,
        table: "variantes_categorias",
        where: { did_variante: did },
        throwIfNotExists: true,
    });

    const catIds = (Array.isArray(categorias) ? categorias : [])
        .map((c) => Number(c?.did))
        .filter((n) => Number.isFinite(n) && n > 0);

    if (catIds.length > 0) {
        await LightdataORM.delete({
            db,
            table: "variantes_categoria_valores",
            where: { did_categoria: catIds },
            quien: userId,
        });

        await LightdataORM.delete({
            db,
            table: "variantes_categorias",
            where: { did: catIds },
            quien: userId,
        });
    }

    return {
        success: true,
        message: "Variante y sus categorías/valores eliminados correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
