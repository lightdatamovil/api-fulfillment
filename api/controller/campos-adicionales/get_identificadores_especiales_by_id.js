import { LightdataORM } from "lightdata-tools";

export async function getIdentificadoresEspecialesById({ db, req }) {
    const { identificador_especial_did } = req.params;






    const [identificador_especial] = await LightdataORM.select({
        db,
        table: "identificadores_especiales",
        where: { did: identificador_especial_did },
        throwIfNotExists: true,
    });
    const data = {
        did: identificador_especial.did,
        nombre: identificador_especial.nombre,
        tipo: identificador_especial.tipo,
        data: identificador_especial.data
    }


    return {
        success: true,
        message: "Identificador especial obtenido correctamente",
        data: data,
        meta: { timestamp: new Date().toISOString() },
    };
}
