import { executeQuery } from "lightdata-tools"

class OrdenTrabajoEstado {
    constructor(did = "", did_orden = "", did_pedido = 0, estado = "", fecha = "", sku = "", quien = 0, superado = 0, elim = 0, connection = null) {

        this.did = did
        this.did_orden = did_orden
        this.did_pedido = did_pedido
        this.estado = estado || ""
        this.fecha = fecha || ""
        this.sku = sku || ""
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
        const checkDidProductoQuery = "SELECT id FROM ordenes_trabajo_pedido_estados WHERE didOrden = ? AND didPedido = ? AND superado = 0 AND elim = 0"
        const results = await executeQuery(connection, checkDidProductoQuery, [this.did_orden, this.did_pedido])

        if (results.length > 0) {
            this.updateState(connection, this.estado, this.did_orden, this.did_pedido)
            return this.createNewRecord(connection)
        } else {
            return this.createNewRecord(connection)
        }
    }

    async createNewRecord(connection) {
        const columnsQuery = "DESCRIBE ordenes_trabajo_pedido_estados"
        const results = await executeQuery(connection, columnsQuery, [])

        const tableColumns = results.map((column) => column.Field)
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined)

        const values = filteredColumns.map((column) => this[column])
        const insertQuery = `INSERT INTO ordenes_trabajo_pedido_estados (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`

        const insertResult = await executeQuery(connection, insertQuery, values)

        if (this.did == 0 || this.did == null) {
            const updateQuery = "UPDATE ordenes_trabajo_pedido_estados SET did = ? WHERE id = ?"
            await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId])
        }

        return { insertId: insertResult.insertId }

    }

    async delete(connection, did) {
        const deleteQuery = "UPDATE ordenes_trabajo_pedido_estados SET elim = 1 WHERE did = ? AND superado = 0"
        await executeQuery(connection, deleteQuery, [did])

        return {
            estado: true,
            message: "Orden de trabajo pedido eliminada correctamente.",
        }
    }
    async updateState(connection, estado, didOrden, didPedido) {
        const updateQuery = "UPDATE ordenes_trabajo_pedido_estados SET estado = 1 WHERE didOrden = ? AND didPedido = ? AND superado = 0"
        await executeQuery(connection, updateQuery, [didOrden, didPedido])

        const updateQuery2 = "UPDATE ordenes_trabajo_pedido SET status = ? WHERE didPedido = ?"
        await executeQuery(connection, updateQuery2, [estado, didPedido])

        const check = "SELECT id FROM ordenes_trabajo_pedido WHERE didOrden = ? AND didPedido = ? AND superado = 0 and elim = 0 and estado =0"
        const results = await executeQuery(connection, check, [didOrden, didPedido])
        if (results.length === 0) {
            const updateQuery3 = "UPDATE ordenes_trabajo SET estado = 1 WHERE did = ?"
            await executeQuery(connection, updateQuery3, [didOrden])
        }

        return {
            estado: true,
            message: "Orden de trabajo pedido eliminada correctamente.",
        }
    }



}

export default OrdenTrabajoEstado
