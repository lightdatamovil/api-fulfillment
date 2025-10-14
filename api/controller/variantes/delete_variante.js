import { LightdataORM, CustomException, Status } from "lightdata-tools";

export async function deleteVariante(dbConnection, req) {
    const { varianteId: did } = req.params;
    const userId = Number(req.user?.userId ?? req.user?.id ?? 0) || null;

    // Verificamos que exista
    const existente = await LightdataORM.select({
        dbConnection,
        table: "variantes",
        where: { did: did },
        throwIfNotExists: false,
        limit: 1,
    });

    if (!Array.isArray(existente) || existente.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No existe la variante con did=${did}`,
            status: Status.notFound,
        });
    }

    // 1) Borrar la variante raíz
    await LightdataORM.delete({
        dbConnection,
        table: "variantes",
        where: { did: did },
        quien: userId,
    });

    // 2) Obtener sus categorías
    const categorias = await LightdataORM.select({
        dbConnection,
        table: "variantes_categorias",
        where: { did_variante: did },
        throwIfNotExists: false,
    });

    const catIds = (Array.isArray(categorias) ? categorias : [])
        .map((c) => Number(c?.did))
        .filter((n) => Number.isFinite(n) && n > 0);

    if (catIds.length > 0) {
        // 2a) Borrar valores de esas categorías
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_categoria_valores",
            where: { did_categoria: catIds },
            quien: userId,
        });

        // 2b) Borrar categorías
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_categorias",
            where: { did: catIds },
            quien: userId,
        });
    }

    return {
        success: true,
        message: "Variante y sus categorías/valores eliminados correctamente",
        data: { did: Number(did), categorias_borradas: catIds },
        meta: { timestamp: new Date().toISOString() },
    };
}
