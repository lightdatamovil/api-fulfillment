import { CustomException, executeQuery, Status } from "lightdata-tools";

export async function deleteVariante(dbConnection, req) {
    const { varianteId } = req.params;

    const deleteQuery =
        "UPDATE atributos SET elim = 1 WHERE did = ? AND superado = 0 AND elim = 0";
    const result = await executeQuery(dbConnection, deleteQuery, [varianteId]);
    if (result.affectedRows === 0) {
        throw new CustomException({
            title: "No se pudo eliminar la variante.",
            message: "No se pudo eliminar la variante. Puede que no exista o ya esté eliminada.",
            status: Status.notFound
        });
    }

    return {
        success: true,
        message: "Variante eliminada correctamente",
        data: {
            did: varianteId
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}