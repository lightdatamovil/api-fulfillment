import { LightdataORM } from "lightdata-tools";

export async function deleteOrdenTrabajo({ db, req }) {
    const { did } = req.params;
    const { userId } = req.user;

    await LightdataORM.delete({
        db,
        table: "ordenes_trabajo",
        where: { did: did },
        quien: userId,
        throwIfNotFound: true
    });

    await LightdataORM.delete({
        db,
        table: "ordenes_trabajo_pedidos",
        where: { did_orden_trabajo: did },
        quien: userId,

    });

    await LightdataORM.delete({
        db,
        table: "ordenes_trabajo_pedidos_estados",
        where: { did_orden_trabajo: did },
        quien: userId,
    });

    return {
        success: true,
        message: "Orden de Trabajo eliminada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
