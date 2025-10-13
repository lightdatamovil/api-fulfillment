import { LightdataORM } from "lightdata-tools";

export async function deleteOrdenTrabajo(db, req) {
    const didParam = req.body?.did ?? req.params?.did;
    const did = Number(didParam);

    await LightdataORM.delete({
        dbConnection: db,
        table: "ordenes_trabajo",
        where: { did_orden_trabajo: did },
        throwIfNotFound: true
    });

    await LightdataORM.delete({
        dbConnection: db,
        table: "ordenes_trabajo_pedidos",
        where: { did_orden_trabajo: did },
    });

    await LightdataORM.delete({
        dbConnection: db,
        table: "ordenes_trabajo_pedidos_estados",
        where: { did_orden_trabajo: did },
    });

    return {
        success: true,
        message: "Orden de Trabajo eliminada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
