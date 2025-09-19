import { CustomException, executeQuery, Status } from "lightdata-tools";

export async function deleteUsuario(dbConnection, req) {
    const { userId } = req.params;

    const deleteQuery = "UPDATE usuarios SET elim = 1 WHERE did = ?";
    const result = await executeQuery(dbConnection, deleteQuery, [userId], true);

    if (result.affectedRows === 0) {
        throw new CustomException({
            title: "No se pudo eliminar el usuario.",
            message: "No se pudo eliminar el usuario. Puede que no exista o ya esté eliminado.",
            status: Status.notFound
        });
    }

    return {
        success: true,
        message: "Usuario eliminado correctamente",
        data: { userId },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}
