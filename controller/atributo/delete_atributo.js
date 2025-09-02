import { CustomException, executeQuery, Status } from "lightdata-tools";

export async function deleteAtributo(dbConnection, req) {
    const { atributoId } = req.params;

    const deleteQuery =
        "UPDATE atributos SET elim = 1 WHERE did = ? AND superado = 0 AND elim = 0";
    const result = await executeQuery(dbConnection, deleteQuery, [atributoId]);
    if (result.affectedRows === 0) {
        throw new CustomException({
            title: "No se pudo eliminar el atributo.",
            message: "No se pudo eliminar el atributo. Puede que no exista o ya esté eliminado.",
            status: Status.notFound
        });
    }

    return {
        success: true,
        message: "Atributo eliminado correctamente",
        data: {
            did: atributoId
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}