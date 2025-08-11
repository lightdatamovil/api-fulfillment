import { executeQuery } from "lightdata-tools"

class Orden_Trabajo {
    constructor(did = "", estado = 0, asignada = "", fecha_inicio = 0, fecha_fin = "", quien = 0, superado = 0, elim = 0, connection = null) {
        this.did = did
        this.estado = estado || 0
        this.asignada = asignada || 0
        this.fecha_inicio = fecha_inicio || ""
        this.fecha_fin = fecha_fin || ""
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
        const checkDidProductoQuery = "SELECT id FROM ordenes_trabajo WHERE did = ?"
        const results = await executeQuery(connection, checkDidProductoQuery, [this.did])

        if (results.length > 0) {
            const updateQuery = "UPDATE ordenes_trabajo SET superado = 1 WHERE did = ?"
            await executeQuery(connection, updateQuery, [this.did])
            return this.createNewRecord(connection)
        } else {
            return this.createNewRecord(connection)
        }
    }

    async createNewRecord(connection) {
        const columnsQuery = "DESCRIBE ordenes_trabajo"
        const results = await executeQuery(connection, columnsQuery, [])

        const tableColumns = results.map((column) => column.Field)
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined)

        const values = filteredColumns.map((column) => this[column])
        const insertQuery = `INSERT INTO ordenes_trabajo (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`

        const insertResult = await executeQuery(connection, insertQuery, values)

        if (this.did == 0 || this.did == null) {
            const updateQuery = "UPDATE ordenes_trabajo SET did = ? WHERE id = ?"
            await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId])
        }

        return { insertId: insertResult.insertId }
    }

    async delete(connection, did) {
        const deleteQuery = "UPDATE ordenes_trabajo SET elim = 1 WHERE did = ? AND superado = 0"
        await executeQuery(connection, deleteQuery, [did])

        return {
            estado: true,
            message: "Orden de trabajo eliminada correctamente.",
        }
    }

    async getOrdenTrabajo(connection) {
        const query = "SELECT * FROM ordenes_trabajo WHERE elim = 0 AND superado = 0"
        const results = await executeQuery(connection, query)

        if (results.length > 0) {
            return results[0]
        } else {
            return null
        }
    }
}

export default Orden_Trabajo
