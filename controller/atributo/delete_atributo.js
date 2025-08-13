import { executeQuery } from "lightdata-tools";

export async function deleteAtributo(dbConnection, req) {
    const { atributoId } = req.params;

    const deleteQuery =
        "UPDATE atributos SET elim = 1 WHERE did = ? AND superado = 0";
    await executeQuery(dbConnection, deleteQuery, [atributoId]);
    const deleteQuery2 =
        "UPDATE atributos_valores SET elim = 1 WHERE didAtributo = ? and superado = 0";
    await executeQuery(dbConnection, deleteQuery2, [atributoId]);

    return {
        estado: true,
        message: "atributo eliminado correctamente.",
    };
}