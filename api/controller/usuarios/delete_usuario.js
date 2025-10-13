import { LightdataORM } from "lightdata-tools";

export async function deleteUsuario(dbConnection, req) {
    const { userDid } = req.params;
    console.log("Deleting user with DID:", userDid);
    const quien = req.user;

    await LightdataORM.delete({
        dbConnection,
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


