import { executeQuery } from "lightdata-tools";


export async function deleteCliente(dbConnection, req) {
    const { clienteId } = req.params;

    const deleteQuery =
        "UPDATE clientes SET elim = 1 WHERE did = ? AND superado = 0 AND elim = 0";
    await executeQuery(dbConnection, deleteQuery, [clienteId]);

    return {
        success: true,
        message: "Cliente eliminado correctamente",
        data: {
            did: clienteId
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}
