import { LightdataORM } from "lightdata-tools";

export async function identificadores_especiales({ db, req }) {
    const { nombre, tipo, longitud_maxima, longitud_minima } = req.body;
    const { userId } = req.user;

    const data = {

        longitud_maxima: longitud_maxima || 0,
        longitud_minima: longitud_minima || 0,


    }

    await LightdataORM.select({
        db,
        table: "identificadores_especiales",
        where: { nombre },
        throwIfExists: true,
    });

    const [newId] = await LightdataORM.insert({
        db,
        table: "identificadores_especiales",
        data: { nombre, tipo, data },
        quien: userId,
    });



    return {
        success: true,
        message: "Identificador especial creado correctamente",
        data: {
            did: newId,
            nombre,
            tipo
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
