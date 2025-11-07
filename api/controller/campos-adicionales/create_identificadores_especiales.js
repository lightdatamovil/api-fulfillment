import { LightdataORM } from "lightdata-tools";

export async function identificadores_especiales({ db, req }) {
    const { nombre, tipo } = req.body;
    const { userId } = req.user;



    await LightdataORM.select({
        db,
        table: "identificadores_especiales",
        where: { nombre },
        throwIfExists: true,
    });

    const [newId] = await LightdataORM.insert({
        db,
        table: "identificadores_especiales",
        data: { nombre, tipo },
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
