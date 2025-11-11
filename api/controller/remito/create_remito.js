import { LightdataORM } from "lightdata-tools";

export async function createRemito({ db, req }) {
    const { did_cliente, observacion, accion, remito_dids } = req.body;
    const { userId } = req.user;

    const remitosItemsA = Array.from(new Set(remito_dids.map(n => Number(n))));
    const fecha = new Date();

    /* await LightdataORM.select({
         db,
         table: "remitos",
         where: { codigo },
         throwIfExists: true,
     });*/

    const [newId] = await LightdataORM.insert({
        db,
        table: "remitos",
        data: { did_cliente, observacion, accion, fecha },
        quien: userId,
    });

    if (remitosItemsA.length > 0) {
        const data = remitosItemsA.map(remitosDids => ({
            did_insumo: newId,
            did_cliente: remitosDids
        }));
        await LightdataORM.insert({
            db,
            table: "remitos_items",
            quien: userId,
            data
        });
    }

    return {
        success: true,
        message: "Remito creado correctamente",
        data: {
            did: newId,
            did_cliente,
            observacion,
            accion,
            remitoItems: Array.from(remitosItemsA)
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
