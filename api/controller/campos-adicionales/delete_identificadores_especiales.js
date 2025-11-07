import { LightdataORM } from "lightdata-tools";

export async function deleteIdentificadoresEspeciales({ db, req }) {
    const { identificador_especial_did } = req.params;
    const { userId } = req.user;
    console.log(identificador_especial_did);


    await LightdataORM.delete({
        db,
        table: "identificadores_especiales",
        where: { did: identificador_especial_did },
        quien: userId
    });



    return {
        success: true,
        message: "Identificador especial eliminado correctamente",
        data: { did: identificador_especial_did },
        meta: { timestamp: new Date().toISOString() },
    };
}
