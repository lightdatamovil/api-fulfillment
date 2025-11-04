import { LightdataORM } from "lightdata-tools";

export async function createOrdenTrabajo(db, req) {
    const { userId } = req.user;
    const { did_usuario, did_pedidos = [] } = req.body;

    if (!did_usuario || !Array.isArray(did_pedidos) || did_pedidos.length === 0) {
        throw new Error("Datos inválidos: falta did_usuario o did_pedidos vacío");
    }

    // Crear la orden de trabajo principal
    const [did_ot] = await LightdataORM.insert({
        dbConnection: db,
        table: "ordenes_trabajo",
        data: {
            estado: "pending",
            did_usuario,
            fecha_inicio: new Date(),
        },
        quien: userId,
    });

    // Crear las relaciones entre la OT y los pedidos
    const pedidosData = did_pedidos.map(item => {
        const did_pedido = typeof item === "object" ? item.did_pedido : item;
        if (!did_pedido) throw new Error("Falta did_pedido en alguno de los pedidos");

        return {
            did_orden_trabajo: did_ot,
            did_pedido,
            flex: (typeof item === "object" ? item.flex : 0) ?? 0,
            estado: (typeof item === "object" ? item.estado : "pendiente") ?? "pendiente",
        };
    });

    await LightdataORM.insert({
        dbConnection: db,
        table: "ordenes_trabajo_pedidos",
        data: pedidosData,
        quien: userId,
    });

    // Actualizar pedidos como trabajados
    await LightdataORM.update({
        dbConnection: db,
        table: "pedidos",
        data: { trabajado: 1, did_ot: did_ot },
        where: `did IN (${did_pedidos.join(",")})`,
        quien: userId,
    });

    return {
        success: true,
        message: "Orden de Trabajo creada correctamente",
        data: { did_ot },
        meta: { timestamp: new Date().toISOString() },
    };
}
