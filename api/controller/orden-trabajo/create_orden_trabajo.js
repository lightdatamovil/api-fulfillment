import { LightdataORM } from "lightdata-tools";

export async function createOrdenTrabajo(db, req) {
    const { userId } = req.user;
    const {
        estado,
        asignada,
        did_cliente,
        fecha_inicio,
        fecha_fin,
        pedidos = [],
        pedidosEstados = []
    } = req.body;

    const [did_ot] = await LightdataORM.insert({
        dbConnection: db,
        table: "ordenes_trabajo",
        data: {
            estado,
            asignada,
            did_cliente,
            fecha_inicio,
            fecha_fin
        },
        quien: userId
    });

    if (pedidos.length > 0) {
        const data = pedidos.map(item => ({
            did_orden_trabajo: did_ot,
            did_pedido: item.did_pedido,
            flex: item.flex ?? 0,
            estado: item.estado
        }));
        console.log(data);
        await LightdataORM.insert({
            dbConnection: db,
            table: "ordenes_trabajo_pedidos",
            data,
            quien: userId
        });
    }

    if (pedidosEstados.length > 0) {
        await LightdataORM.insert({
            dbConnection: db,
            table: "ordenes_trabajo_pedidos_estados",
            data: pedidosEstados.map(item => ({
                did_orden_trabajo: did_ot,
                did_pedido: item.did_pedido,
                estado: item.estado,
                fecha: item.fecha,
            })),
            quien: userId
        });
    }

    await LightdataORM.update({
        dbConnection: db,
        table: "pedidos",
        data: {
            trabajada: 1
        },
        where: `did IN (${pedidos.map(p => p.did_pedido).join(",")})`,
        quien: userId
    });


    return {
        success: true,
        message: "Orden de Trabajo creada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
