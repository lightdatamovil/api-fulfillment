import { LightdataORM } from "lightdata-tools";

export async function deleteLogistica({ db, req }) {
    const { logisticaDid } = req.params;
    const { userId } = req.user;

    await LightdataORM.delete({
        db,
        table: "logisticas",
        where: { did: logisticaDid },
        quien: userId
    });

    const links = await LightdataORM.select({
        db,
        table: "logisticas_direcciones",
        where: { did_logistica: logisticaDid },
        select: "did"
    });

    await LightdataORM.delete({
        db,
        table: "logisticas_direcciones",
        where: { did: links },
        quien: userId
    });

    return {
        success: true,
        message: "logistica eliminado correctamente",
        data: {
            did: logisticaDid
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}
