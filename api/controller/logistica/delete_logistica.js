import { LightdataORM } from "lightdata-tools";



export async function deleteLogistica(dbConnection, req) {
    const { logisticaDid } = req.params;
    const { userId } = req.user;

    await LightdataORM.delete({
        dbConnection,
        table: "logisticas",
        did: logisticaDid,
        quien: userId

    });

    const links = await LightdataORM.select({
        dbConnection,
        table: "logisticas_direcciones",
        column: "did_logistica",
        value: logisticaDid,
        select: "did"
    });

    await LightdataORM.delete({
        dbConnection,
        table: "logisticas_direcciones",
        did: links,
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
