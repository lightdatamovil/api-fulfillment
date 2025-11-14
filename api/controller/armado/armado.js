import { LightdataORM } from "lightdata-tools";
import { egresoStockMasivo } from "../stock/egreso_stock_masivo";

export async function armado(db, req) {
    const { userId } = req.user;

    const { did_ot } = req.body ?? {};



    const updateOT = await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: did_ot },
        quien: userId,
        data: {
            estado: 3
        },
    });


    const updateArmado = await LightdataORM.select({
        db,
        table: "pedidos",
        where: { did_ot: did_ot },
        quien: userId,
        data: {
            armado: 1
        },
    });



    const egreso = await egresoStockMasivo({ db, req });


    return {
        success: true,
        message: "Armado actualizado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
