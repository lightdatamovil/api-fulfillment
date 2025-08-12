import { executeQuery } from "lightdata-tools"

export async function getAll(connection) {
    const selectQuery = ` SELECT * FROM insumos
        WHERE elim = 0 AND superado = 0
        ORDER BY did DESC
        `
    const results = await executeQuery(connection, selectQuery, [])

    return results
}