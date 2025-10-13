import { LightdataORM } from "lightdata-tools";

export async function createOrdenTrabajo(db, req) {
    const { userId } = req.user;
    const body = req.body;

    const estado = Number.isFinite(Number(body.estado)) ? Number(body.estado) : null;
    const asignada = Number.isFinite(Number(body.asignada)) ? Number(body.asignada) : 0;
    const fecha_inicio = body.fecha_inicio ?? null;
    const fecha_fin = body.fecha_fin ?? null;
    const pedidos = body.pedidos ?? [];
    const pedidosEstados = body.pedidosEstados ?? [];

    const [did_ot] = await LightdataORM.insert({
        dbConnection: db,
        table: "ordenes_trabajo",
        data: {
            estado,
            asignada,
            fecha_inicio,
            fecha_fin,
            quien: userId
        },
    });

    if (pedidos.length > 0) {
        await LightdataORM.insert({
            dbConnection: db,
            table: "ordenes_trabajo_pedidos",
            data: pedidos.map(item => ({
                did_orden_trabajo: did_ot,
                did_pedido: Number(item?.did_pedido),
                flex: Number(item?.flex),
                estado: Number(item?.estado)
            })),
        });
    }

    if (pedidosEstados.length > 0) {
        await LightdataORM.insert({
            dbConnection: db,
            table: "ordenes_trabajo_pedidos_estados",
            data: pedidosEstados.map(item => ({
                did_pedido: Number(item?.did_pedido),
                did_orden_trabajo: did_ot,
                estado: Number(item?.estado),
                fecha: item?.fecha ?? new Date(),
            }))
        });
    }

    return {
        success: true,
        message: "Orden de Trabajo creada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
