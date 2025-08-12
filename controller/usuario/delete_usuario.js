import { executeQuery } from "lightdata-tools"

export async function deleteUsuario(dbConnection, req) {
    const { did } = req.body;
    const deleteQuery = "UPDATE usuarios SET elim = 1 WHERE did = ?"
    await executeQuery(dbConnection, deleteQuery, [did])
    return {
        estado: true,
        message: "Usuario eliminado correctamente.",
    }
}