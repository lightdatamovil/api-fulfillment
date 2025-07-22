const { executeQuery } = require("../../dbconfig")

class ProductoVariantes {
    constructor(
        did = "",
        didProducto = 0,
        data = "",
        quien = 0,
        superado = 0,
        elim = 0,
        connection = null
    ) {
        this.did = did
        this.didProducto = didProducto
        this.data = data || ""
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
            console.error("Error en el método insert:", error.message)
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
        try {
            const checkDidProductoQuery = "SELECT id FROM productos_variantes WHERE did = ?"
            const results = await executeQuery(connection, checkDidProductoQuery, [this.did])

            if (results.length > 0) {
                const updateQuery = "UPDATE productos_variantes SET superado = 1 WHERE did = ?"
                await executeQuery(connection, updateQuery, [this.did])
                return this.createNewRecord(connection)
            } else {
                return this.createNewRecord(connection)
            }
        } catch (error) {
            throw error
        }
    }

    async createNewRecord(connection) {
        try {
            const columnsQuery = "DESCRIBE productos_variantes"
            const results = await executeQuery(connection, columnsQuery, [])

            const tableColumns = results.map((column) => column.Field)
            const filteredColumns = tableColumns.filter((column) => this[column] !== undefined)

            const values = filteredColumns.map((column) => this[column])
            const insertQuery = `INSERT INTO productos_variantes (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`

            const insertResult = await executeQuery(connection, insertQuery, values)

            if (this.did == 0 || this.did == null) {
                const updateQuery = "UPDATE productos_variantes SET did = ? WHERE id = ?"
                await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId])
            }

            return { insertId: insertResult.insertId }
        } catch (error) {
            throw error
        }
    }


    async deleteMissing(connection, didAtributo, didsActuales = []) {
        try {
            if (!Array.isArray(didsActuales)) {
                didsActuales = []
            }

            let deleteQuery = ""
            let params = []

            if (didsActuales.length > 0) {
                deleteQuery = `
        UPDATE productos_variantes
        SET elim = 1
        WHERE didProducto = ? AND did NOT IN (${didsActuales.map(() => "?").join(", ")}) AND elim = 0
      `
                params = [didAtributo, ...didsActuales]
            } else {
                // Si el array está vacío, eliminar todos los registros del atributo
                deleteQuery = `
        UPDATE productos_variantes
        SET elim = 1
        WHERE didProducto = ? AND elim = 0
      `
                params = [didAtributo]
            }

            await executeQuery(connection, deleteQuery, params)
        } catch (error) {
            throw error
        }
    }

}

module.exports = ProductoVariantes
