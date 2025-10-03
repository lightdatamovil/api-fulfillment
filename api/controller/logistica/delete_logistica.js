import { CustomException, executeQuery, Status } from "lightdata-tools";


export async function deleteCliente(dbConnection, req) {
    const { clienteId } = req.params;

    const deleteQuery =
        "UPDATE clientes SET elim = 1 WHERE did = ? AND superado = 0 AND elim = 0";
    const result = await executeQuery(dbConnection, deleteQuery, [clienteId]);
    if (result.affectedRows === 0) {

        throw new CustomException({
            title: "No se pudo eliminar el cliente.",
            message: "No se pudo eliminar el cliente. Puede que no exista o ya esté eliminado.",
            status: Status.notFound
        });
    }


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
