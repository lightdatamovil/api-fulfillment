import { LightdataORM } from "lightdata-tools";

export async function deleteDeposito({ db, req }) {
    const { userId } = req.user || {};
    const depositoDid = req.params.depositoDid;

    await LightdataORM.delete({
        db,
        table: "depositos",
        where: { did: Number(depositoDid) },
        quien: userId,
        throwIfNotFound: true,
    });

    return {
        success: true,
        message: "Depósito eliminado correctamente",
        data: { did: Number(depositoDid) },
        meta: { timestamp: new Date().toISOString() },
    };
}
