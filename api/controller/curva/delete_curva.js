import { LightdataORM } from "lightdata-tools";

export async function deleteCurva(dbConnection, req) {
    const { curvaDid } = req.params;
    const { userId } = req.user;

    await LightdataORM.delete({
        dbConnection,
        table: "curvas",
        where: { did: curvaDid },
        quien: userId,
        throwIfNotFound: true,
    });

    const vlinks = await LightdataORM.select({
        dbConnection,
        table: "variantes_curvas",
        where: { did_curva: curvaDid },
    });

    if (vlinks.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_curvas",
            where: { did: vlinks.map((l) => l.did) },
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
