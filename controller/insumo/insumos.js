import { executeQuery } from "lightdata-tools"

class Insumo {
    constructor(did = "", nombre = "", logisticaLD = 0, codigo = "", codigoLD = "", quien = 0, superado = 0, elim = 0, connection = null) {
        this.did = did
        this.nombre = nombre
        this.logisticaLD = logisticaLD
        this.codigo = codigo
        this.codigoLD = codigoLD
        this.quien = quien || 0
        this.superado = superado || 0
        this.elim = elim || 0

        this.connection = connection
    }

    toJSON() {
        return JSON.stringify(this)
    }

    async insert() {
        try {
            if (this.did === null || this.did === "") {
                return this.createNewRecord(this.connection)
            } else {
                return this.checkAndUpdateDidProducto(this.connection)
            }
        } catch (error) {
            throw {
                status: 500,
                response: {
                    estado: false,
                    error: -1,
                },
            }
        }
    }

    async checkAndUpdateDidProducto(connection) {
        const checkDidProductoQuery = "SELECT id FROM logisticas WHERE did = ?"
        const results = await executeQuery(connection, checkDidProductoQuery, [this.did])

        if (results.length > 0) {
            const updateQuery = "UPDATE logisticas SET superado = 1 WHERE did = ?"
            await executeQuery(connection, updateQuery, [this.did])
            return this.createNewRecord(connection)
        } else {
            return this.createNewRecord(connection)
        }
    }

    async createNewRecord(connection) {
        const querycheck = "SELECT codigo FROM logisticas WHERE codigo = ? and superado = 0 and elim = 0"
        const resultscheck = await executeQuery(this.connection, querycheck, [this.codigo])
        if (resultscheck.length > 0) {
            return {
                estado: false,
                message: "El codigo de la logistica ya existe.",
            }
        }
        const columnsQuery = "DESCRIBE logisticas"
        const results = await executeQuery(connection, columnsQuery, [])

        const tableColumns = results.map((column) => column.Field)
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined)

        const values = filteredColumns.map((column) => this[column])
        const insertQuery = `INSERT INTO logisticas (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`

        const insertResult = await executeQuery(connection, insertQuery, values)

        if (this.did == 0 || this.did == null) {
            const updateQuery = "UPDATE logisticas SET did = ? WHERE id = ?"
            await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId])
        }

        return { insertId: insertResult.insertId }
    }

    async delete(connection, did) {
        const deleteQuery = "UPDATE logisticas SET elim = 1 WHERE did = ? AND superado = 0"
        await executeQuery(connection, deleteQuery, [did])

        return {
            estado: true,
            message: "Logistica eliminado correctamente.",
        }
    }

    async getAll(connection) {
        const selectQuery = ` SELECT * FROM insumos
        WHERE   elim = 0 AND superado = 0
        ORDER BY did DESC
        `
        const results = await executeQuery(connection, selectQuery, [])

        return results
    }

    async getInsumos(connection, filtros = {}) {
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
            const totalResult = await executeQuery(
                connection,
                totalQuery,
                values,

                true
            )
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

            const results = await executeQuery(connection, dataQuery, dataValues)
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
    async getInsumosById(connection, did) {
        const selectQuery = `
        SELECT * FROM insumos
        WHERE did = ? AND elim = 0 AND superado = 0
      `
        const results = await executeQuery(connection, selectQuery, [did])
        if (results.length === 0) {
            return {
                estado: false,
                message: "No se encontró el insumo con el ID proporcionado.",
            }
        }

        return results
    }
}

export default Insumo
