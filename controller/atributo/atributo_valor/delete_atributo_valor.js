import { executeQuery } from "lightdata-tools";

export async function deleteAtributoValor(connection, req) {
    const { atributoId, valorId } = req.params;
    const deleteQuery = "UPDATE atributos_valores SET elim = 1 WHERE didAtributo = ? AND did = ?";
    await executeQuery(connection, deleteQuery, [atributoId, valorId], true);

    return {
        success: true,
        message: "Atributo valor eliminado correctamente",
        data: { didAtributo: Number(atributoId), did: Number(valorId) },
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
}
