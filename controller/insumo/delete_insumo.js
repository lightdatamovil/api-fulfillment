import { executeQuery } from "lightdata-tools"

export async function deleteInsumo(dbConnection, req) {
    const { insumoId } = req.params;
    const deleteQuery = "UPDATE logisticas SET elim = 1 WHERE did = ? AND superado = 0"
    await executeQuery(dbConnection, deleteQuery, [insumoId])

    return {
        estado: true,
        message: "Logistica eliminado correctamente.",
    }
}