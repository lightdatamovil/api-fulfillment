import { CustomException, executeQuery } from "lightdata-tools"

export async function getInsumosById(dbConnection, req) {
    const { insumoId } = req.params;

    const selectQuery = `
        SELECT * FROM insumos
        WHERE did = ? AND elim = 0 AND superado = 0
      `
    const results = await executeQuery(dbConnection, selectQuery, [insumoId])
    if (results.length === 0) {
        throw new CustomException({
            title: "Insumo no encontrado",
            message: "No se encontró el insumo con el ID proporcionado.",
        })
    }

    return results
}