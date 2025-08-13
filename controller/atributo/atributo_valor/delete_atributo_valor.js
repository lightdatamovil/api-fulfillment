import { executeQuery } from "lightdata-tools";

export async function deleteAtributoValor(connection, did) {
    const deleteQuery = "UPDATE atributos_valores SET elim = 1 WHERE did = ?";
    await executeQuery(connection, deleteQuery, [did]);
    return {
        estado: true,
        message: "atributo eliminado correctamente.",
    };
}
