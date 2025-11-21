import { LightdataORM } from "lightdata-tools";

export async function desestimar({ db, req }) {
    const { userId } = req.user;
    const { did } = req.params;

    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: did },
        quien: userId,
        data: {
            estado: 4
        },
    });

    await LightdataORM.update({
        db,
        table: "pedidos",
        where: { did_ot: did },
        versionKey: "did_ot",
        quien: userId,
        data: {
            trabajado: 0,
            did_ot: null
        },
    });

    return {
        success: true,
        message: "Armado actualizado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
