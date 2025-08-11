const { executeQuery } = require("lightdata-tools")

class Orden_trabajo_pedido {
    constructor(did = "", didOrden = "", did_Pedido_Habbilitado = 0, flex = 0, quien = 0, superado = 0, elim = 0, connection = null) {
        this.did = did
        this.did_orden = didOrden || ""
        this.did_pedido_habilitado = did_Pedido_Habbilitado || 0
        this.flex = flex || 0
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
        const checkDidProductoQuery = "SELECT id FROM ordenes_trabajo_pedido WHERE did = ?"
        const results = await executeQuery(connection, checkDidProductoQuery, [this.did])

        if (results.length > 0) {
            const updateQuery = "UPDATE ordenes_trabajo_pedido SET superado = 1 WHERE did = ?"
            await executeQuery(connection, updateQuery, [this.did])
            return this.createNewRecord(connection)
        } else {
            return this.createNewRecord(connection)
        }
    }

    async createNewRecord(connection) {
        const columnsQuery = "DESCRIBE ordenes_trabajo_pedido"
        const results = await executeQuery(connection, columnsQuery, [])

        const tableColumns = results.map((column) => column.Field)
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined)

        const values = filteredColumns.map((column) => this[column])
        const insertQuery = `INSERT INTO ordenes_trabajo_pedido (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`

        const insertResult = await executeQuery(connection, insertQuery, values)

        if (this.did == 0 || this.did == null) {
            const updateQuery = "UPDATE ordenes_trabajo_pedido SET did = ? WHERE id = ?"
            await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId])
        }

        return { insertId: insertResult.insertId }
    }

    async delete(connection, did) {
        const deleteQuery = "UPDATE ordenes_trabajo_pedido SET elim = 1 WHERE did = ? AND superado = 0"
        await executeQuery(connection, deleteQuery, [did])

        return {
            estado: true,
            message: "Orden de trabajo pedido eliminada correctamente.",
        }
    }



}

module.exports = Orden_trabajo_pedido
