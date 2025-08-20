import { executeQuery } from "lightdata-tools";

export async function deleteUsuario(dbConnection, req) {
    const { userId } = req.params;

    const deleteQuery = "UPDATE usuarios SET elim = 1 WHERE did = ?";
    await executeQuery(dbConnection, deleteQuery, [userId], true);

    return {
        success: true,
        message: "Usuario eliminado correctamente",
        data: { userId },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}
