import { executeQuery } from "lightdata-tools";

export async function deleteAtributo(dbConnection, req) {
    const { atributoId } = req.params;

    const deleteQuery =
        "UPDATE atributos SET elim = 1 WHERE did = ? AND superado = 0 AND elim = 0";
    await executeQuery(dbConnection, deleteQuery, [atributoId]);

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