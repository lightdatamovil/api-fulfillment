import { LightdataORM } from "lightdata-tools";

export async function deleteUsuario({ db, req }) {
    const { userDid } = req.params;
    const quien = req.user;

    await LightdataORM.delete({
        db,
        table: "usuarios",
        where: { did: userDid },
        quien: quien
    });

    return {
        success: true,
        message: "Usuario eliminado correctamente",
        data: { userDid },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}


