import { LightdataORM } from "lightdata-tools";
import { egresoStockMasivoArmado } from "../../src/functions/egreso_stock_armado.js";

export async function armar({ db, req }) {
    const { userId } = req.user;
    const { did_ot, alertada, productos } = req.body ?? {};

    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: did_ot },
        quien: userId,
        data: {
            estado: 3
        },
    });

    await LightdataORM.update({
        db,
        table: "pedidos",
        where: { did_ot: did_ot },
        versionKey: "did_ot",
        quien: userId,
        data: {
            armado: 1
        },
    });

    if (!alertada) {
        await egresoStockMasivoArmado({ db, productos, quien: userId });
    }

    return {
        success: true,
        message: "Armado actualizado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
