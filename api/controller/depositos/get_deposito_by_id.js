import { LightdataORM } from "lightdata-tools";

export async function getDepositoById({ db, req }) {
    const didParam = Number(req.params?.depositoDid);

    const [deposito] = await LightdataORM.select({
        db,
        table: "depositos",
        where: { did: didParam },
        throwIfNotExists: true,
    });

    return {
        success: true,
        message: "Depósito obtenido correctamente",
        data: deposito,
        meta: { timestamp: new Date().toISOString() },
    };
}
