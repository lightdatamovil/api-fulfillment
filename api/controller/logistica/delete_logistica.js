import { LightdataQuerys } from "lightdata-tools";



export async function deleteLogistica(dbConnection, req) {
    const { logisticaDid } = req.params;
    const { userId } = req.user;

    await LightdataQuerys.delete({
        dbConnection,
        tabla: "logisticas",
        did: logisticaDid,
        quien: userId
    });

    const links = await DbUtils.verifyExistsAndSelect({
        db: dbConnection,
        table: "logisticas_clientes",
        column: "did_logistica",
        valor: logisticaDid,
        select: "did"
    });

    await LightdataQuerys.delete({
        dbConnection,
        tabla: "logisticas_direcciones",
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
