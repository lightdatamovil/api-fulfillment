import { CustomException, executeQuery, Status } from "lightdata-tools";


export async function deleteLogistica(dbConnection, req) {
    const { logisticaDid } = req.params;

    const deleteQuery =
        "UPDATE logisticas SET elim = 1  WHERE did = ? AND superado = 0 AND elim = 0";
    const result = await executeQuery(dbConnection, deleteQuery, [logisticaDid]);
    if (result.affectedRows === 0) {

        throw new CustomException({
            title: "No se pudo eliminar el logistica.",
            message: "No se pudo eliminar el logistica. Puede que no exista o ya esté eliminado.",
            status: Status.notFound
        });
    }
    await executeQuery(dbConnection, "UPDATE logisticas_direcciones SET elim = 1 WHERE logistica_did = ? and superado = 0 and elim = 0", [logisticaDid]);

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
