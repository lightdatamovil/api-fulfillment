import { executeQuery } from "lightdata-tools"

export async function getFilteredInsumos(dbConnection, filtros = {}) {
    try {
        const conditions = ["i.elim = 0", "i.superado = 0"]
        const values = []

        if (filtros.did) {
            conditions.push("i.did = ?")
            values.push(filtros.did)
        }
        if (filtros.codigo) {
            conditions.push("i.codigo LIKE ?")
            values.push(`%${filtros.codigo}%`)
        }
        if (filtros.nombre) {
            conditions.push("i.nombre LIKE ?")
            values.push(`%${filtros.nombre}%`)
        }
        if (filtros.habilitado != "") {
            conditions.push("i.habilitado = ?")
            values.push(filtros.habilitado)
        }
        if (filtros.didCliente) {
            conditions.push("i.didCliente = ?")
            values.push(filtros.didCliente)
        }
        if (filtros.clientes) {
            const clientesArray = filtros.clientes
                .split(",")
                .map((c) => c.trim())
                .filter((c) => c !== "")

            if (clientesArray.length > 0) {
                const placeholders = clientesArray.map(() => "?").join(",")
                conditions.push(`i.clientes IN (${placeholders})`)
                values.push(...clientesArray)
            }
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
        const pagina = Number(filtros.pagina) || 1
        const cantidadPorPagina = Number(filtros.cantidad) || 10
        const offset = (pagina - 1) * cantidadPorPagina
        const totalQuery = `SELECT COUNT(*) as total FROM insumos i ${whereClause}`
        const totalResult = await executeQuery(dbConnection, totalQuery, values, true)
        const totalRegistros = totalResult[0].total
        const totalPaginas = Math.ceil(totalRegistros / cantidadPorPagina)
        const dataQuery = `
        SELECT i.did, i.nombre, i.codigo,  i.habilitado
        FROM insumos i
        ${whereClause}
        ORDER BY i.did DESC
        LIMIT ? OFFSET ?
        `
        const dataValues = [...values, cantidadPorPagina, offset]

        const results = await executeQuery(dbConnection, dataQuery, dataValues)
        return {
            data: results,
            totalRegistros,
            totalPaginas,

            pagina,
            cantidad: cantidadPorPagina,
            insumos: results,
        }
    } catch (error) {
        throw {
            estado: false,
            error: -1,
            message: error.message || error,
        }
    }
}