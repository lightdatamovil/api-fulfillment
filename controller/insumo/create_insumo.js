import { executeQuery } from "lightdata-tools"

export async function createInsumo(dbConnection, req) {
    const { did, nombre, codigo, idCliente } = req.body;

    const querycheck = "SELECT codigo FROM logisticas WHERE codigo = ? and superado = 0 and elim = 0"
    const resultscheck = await executeQuery(dbConnection, querycheck, [codigo])
    if (resultscheck.length > 0) {
        return {
            estado: false,
            message: "El codigo de la logistica ya existe.",
        }
    }
    const columnsQuery = "DESCRIBE logisticas"
    const results = await executeQuery(dbConnection, columnsQuery, [])

    const tableColumns = results.map((column) => column.Field)
    const filteredColumns = tableColumns.filter((column) => this[column] !== undefined)

    const values = filteredColumns.map((column) => this[column])
    const insertQuery = `INSERT INTO logisticas (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`

    const insertResult = await executeQuery(dbConnection, insertQuery, values)

    if (did == 0 || did == null) {
        const updateQuery = "UPDATE logisticas SET did = ? WHERE id = ?"
        await executeQuery(dbConnection, updateQuery, [insertResult.insertId, insertResult.insertId])
    }

    return { message: "Insumo creado correctamente", body: insertResult.insertId }
}