import { LightdataQuerys } from "lightdata-tools";

export async function deleteCurva(dbConnection, req) {
    const { curvaDid } = req.params;
    const { userId } = req.user;

    // Borra la curva principal
    await LightdataQuerys.delete({
        dbConnection,
        table: "curvas",
        did: curvaDid,
        quien: userId,
    });

    // Borra links a variantes
    const vlinks = await LightdataQuerys.select({
        dbConnection,
        table: "variantes_curvas",
        column: "did_curva",
        value: curvaDid,
    });

    if (vlinks.length > 0) {
        await LightdataQuerys.delete({
            dbConnection,
            table: "variantes_curvas",
            did: vlinks.map((l) => l.did),
            quien: userId,
        });
    }

    // Borra links a categorías de variantes
    const clinks = await LightdataQuerys.select({
        dbConnection,
        table: "variantes_categorias_curvas",
        column: "did_curva",
        value: curvaDid,
    });

    if (clinks.length > 0) {
        await LightdataQuerys.delete({
            dbConnection,
            table: "variantes_categorias_curvas",
            did: clinks.map((l) => l.did),
            quien: userId,
        });
    }

    return {
        success: true,
        message: "Curva eliminada correctamente",
        data: { did: curvaDid },
        meta: { timestamp: new Date().toISOString() },
    };
}
