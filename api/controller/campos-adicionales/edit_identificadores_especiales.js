import { LightdataORM } from "lightdata-tools";

export async function editIdentificadoresEspeciales({ db, req }) {


    const { userId } = req.user;
    const { identificador_especial_did } = req.params;
    const { nombre, tipo } = req.body ?? {};
    console.log(userId, "sdfadasd");




    await LightdataORM.select({
        db,
        table: "identificadores_especiales",
        where: { did: identificador_especial_did },

        throwIfNotExists: true,
    });



    await LightdataORM.update({
        db,
        table: "identificadores_especiales",
        where: { did: identificador_especial_did },
        quien: userId,
        data: {
            nombre: nombre,
            config: tipo
        },
    });







    return {
        success: true,
        message: "Identificador especial actualizado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
