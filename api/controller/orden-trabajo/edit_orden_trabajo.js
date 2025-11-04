import { isDefined, LightdataORM } from "lightdata-tools";

export async function editOrdenTrabajo(db, req) {
    const { userId } = req.user;
    const { estado, asignada, fecha_fin, pedidos } = req.body;
    const did_ot = req.params.did;

    const [prev] = await LightdataORM.select({
        db,
        table: "ordenes_trabajo",
        throwIfNotExists: true,
        where: { did: did_ot },
        quien: userId
    });

    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        data: {
            estado: isDefined(estado) ? estado : prev.estado,
            asignada: isDefined(asignada) ? asignada : prev.asignada,
            fecha_fin: isDefined(fecha_fin) ? fecha_fin : prev.fecha_fin
        },
        where: { did: did_ot },
        quien: userId
    });

    if (pedidos.add.length > 0) {
        await LightdataORM.insert({
            db,
            table: "ordenes_trabajo_pedidos",
            data: pedidos.add.map(it => ({
                did_orden_trabajo: did_ot,
                did_pedido: Number(it)
            })),
            quien: userId
        });
    }

    if (pedidos.remove.length > 0) {
        await LightdataORM.delete({
            db,
            table: "ordenes_trabajo_pedidos",
            where: { did: pedidos.remove.map(it => Number(it)) },
            quien: userId
        });
    }

    return {
        success: true,
        message: "Orden de Trabajo versionada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
