import { LightdataORM } from "lightdata-tools";
import { egresoStockMasivoArmado } from "../../src/functions/egreso_stock_armado.js";

export async function armado({ db, req }) {
    const { userId } = req.user;

    const { did_ot } = req.body ?? {};



    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        where: { did: did_ot },
        quien: userId,
        data: {
            estado: 3
        },
    });

    const [selectdidot] = await LightdataORM.select({
        db,
        table: "pedidos",
        where: { did: did_ot },
        throwIfNotFound: true
    })

    const number = selectdidot.number

    await LightdataORM.update({
        db,
        table: "pedidos",
        where: { did_ot: did_ot },
        quien: userId,
        data: {
            armado: 1
        },
    });




    const egreso = await egresoStockMasivoArmado({ db, productos: req.body.productos, number, userId });

    console.log(egreso);



    return {
        success: true,
        message: "Armado actualizado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
