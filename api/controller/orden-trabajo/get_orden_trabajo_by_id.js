import { CustomException, LightdataORM } from "lightdata-tools";

export async function getOrdenTrabajoById({ db, req }) {
    const didParam = req.params?.did ?? req.params?.id;
    const did = Number(didParam);

    if (!Number.isFinite(did) || did <= 0) {
        throw new CustomException({ title: "Parámetro inválido", message: "did debe ser numérico > 0" });
    }

    const [ot] = await LightdataORM.select({
        db,
        table: "ordenes_trabajo",
        where: { did },
        throwIfNotExists: true,
    });

    const pedidos = await LightdataORM.select({
        db, table: "ordenes_trabajo_pedidos",
        where: { did_orden_trabajo: did },
        select: ["did_orden_trabajo", "did_pedido", "quien", "autofecha"],
    });

    const historial = await LightdataORM.select({
        db,
        table: "ordenes_trabajo_pedidos_estados",
        where: { did_orden_trabajo: did },
        select: ["did", "did_pedido", "did_orden_trabajo", "fecha", "quien", "autofecha"],
    });

    return {
        success: true,
        message: "Orden de Trabajo obtenida correctamente",
        data: {
            orden_trabajo: ot[0],
            pedidos,
            historial,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
