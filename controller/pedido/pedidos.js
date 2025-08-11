import { executeQuery } from "lightdata-tools"

let clientesCache = {}

class Pedidos {
    constructor(
        did = "",
        didEnvio = "",
        didCliente = "",
        didCuenta = "",
        status = "",
        flex = 0,
        number = "",
        observaciones = "",
        armado = 0,
        descargado = 0,
        fecha_armado = null,
        fecha_venta = null,
        quien_armado = "",
        ml_shipment_id = null,
        ml_id = "",
        mi_packing_id = null,
        buyer_id = null,
        buyer_nickname = null,
        buyer_name = null,
        buyer_last_name = null,
        total_amount = null,
        seller_sku = null,

        connection = null
    ) {
        this.did = did
        this.didEnvio = didEnvio
        this.didCliente = didCliente
        this.didCuenta = didCuenta
        this.status = status
        this.flex = flex
        this.number = number
        this.observaciones = observaciones
        this.armado = armado
        this.descargado = descargado
        this.fecha_armado = fecha_armado
        this.fecha_venta = fecha_venta
        this.quien_armado = quien_armado
        this.ml_shipment_id = ml_shipment_id || ""
        this.ml_id = ml_id
        this.mi_packing_id = mi_packing_id
        this.buyer_id = buyer_id
        this.buyer_nickname = buyer_nickname
        this.buyer_name = buyer_name
        this.buyer_last_name = buyer_last_name
        this.total_amount = total_amount
        this.seller_sku = seller_sku

        this.connection = connection
    }

    toJSON() {
        return JSON.stringify(this)
    }

    async insert() {
        try {
            return this.checkAndUpdateDidEnvio(this.connection)
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

    async checkAndUpdateDidEnvio(connection) {
        const checkDidEnvioQuery = "SELECT number,did FROM pedidos WHERE number = ?  and superado = 0 and elim = 0"
        const results = await executeQuery(connection, checkDidEnvioQuery, [this.number, this.didCliente, this.didCuenta, this.flex])

        this.did = results[0]?.did || 0

        if (results.length > 0) {
            return await this.updateRecord(connection)
        } else {
            // Si `didEnvio` no existe, crear un nuevo registro directamente
            return this.createNewRecord(connection)
        }
    }

    async createNewRecord(connection) {
        const columnsQuery = "DESCRIBE pedidos"
        const results = await executeQuery(connection, columnsQuery, [])

        const tableColumns = results.map((column) => column.Field)
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined && !(column === "did" && (this[column] === 0 || this[column] === null)))

        const values = filteredColumns.map((column) => this[column])
        const insertQuery = `INSERT INTO pedidos (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`

        const insertResult = await executeQuery(connection, insertQuery, values)
        const insertId = insertResult.insertId
        if (this.did == 0 || this.did == null) {
            const didquery = "select did from pedidos where number = ? "
            const didresult = await executeQuery(connection, didquery, [this.number])
            this.did = didresult[0].did
            const updateQuery = "UPDATE pedidos SET did = ? WHERE id = ?"
            await executeQuery(connection, updateQuery, [insertId, insertId])
        }

        // await this.insertHistorial(connection, insertId);

        return { insertId: insertId || this.did }
    }

    async updateRecord(connection) {
        const columnsQuery = "DESCRIBE pedidos"
        const results = await executeQuery(connection, columnsQuery, [])

        const tableColumns = results.map((column) => column.Field)
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined && column !== "id" && column !== "did")

        const setClause = filteredColumns.map((column) => `${column} = ?`).join(", ")
        const values = filteredColumns.map((column) => this[column])

        const updateQuery = `UPDATE pedidos SET ${setClause} WHERE number = ?`
        values.push(this.number)

        await executeQuery(connection, updateQuery, values)

        return { insertId: this.did }

    }

    async eliminar(connection, did) {
        const deleteQuery = "UPDATE pedidos set elim = 1 WHERE did = ?"
        await executeQuery(connection, deleteQuery, [did])
        const deletetequery2 = "UPDATE pedidos_items set elim = 1 WHERE didOrden = ? and superado = 0"
        await executeQuery(connection, deletetequery2, [did])
        const deletequery3 = "UPDATE pedidos set elim = 1 WHERE didOrden = ? and superado = 0"
        await executeQuery(connection, deletequery3, [did])
    }

    async getOrdenPorId(connection, did, pagina = 1, cantidad = 10) {
        const offset = (pagina - 1) * cantidad

        // 1. Consultar total de ítems
        const countQuery = `
                SELECT COUNT(*) AS totalItems 
                FROM pedidos_items
                WHERE didPedido = ? AND elim = 0 AND superado = 0
            `
        const countResult = await executeQuery(connection, countQuery, [did])
        const totalItems = countResult[0]?.totalItems ?? 0
        const totalPages = Math.ceil(totalItems / cantidad)

        // 2. Consultar datos de la orden con ítems paginados
        const query = `
                SELECT 
                    o.id, o.did, o.didEnvio, o.didCliente, o.didCuenta, o.status, o.flex, 
                    o.number, o.fecha_venta, o.observaciones, o.armado, o.descargado, 
                    o.fecha_armado, o.quien_armado, o.autofecha AS orden_autofecha,


                    o.ml_shipment_id, o.ml_id, o.ml_pack_id, o.buyer_id, o.buyer_nickname, 
                    o.buyer_name, o.buyer_last_name, o.total_amount, o.seller_id, o.didOt,

                    oi.codigo, oi.imagen, oi.descripcion, oi.ml_id AS item_ml_id, oi.dimensions, 
                    oi.cantidad, oi.variacion, oi.seller_sku, 
                    oi.descargado AS item_descargado, 
                    oi.autofecha AS item_autofecha,
                    oi.idVariacion, oi.user_product_id, oi.variation_attributes
                FROM pedidos o
                LEFT JOIN (
                    SELECT * FROM pedidos_items
                    WHERE elim = 0 AND superado = 0 
                    AND didPedido = ?
                    LIMIT ? OFFSET ?
                ) AS oi ON o.did = oi.didPedido
                WHERE o.did = ? AND o.elim = 0 AND o.superado = 0
            `

        const results = await executeQuery(connection, query, [did, cantidad, offset, did])

        let cliente = ""
        const clienteQuery = `SELECT nombre_fantasia FROM clientes WHERE did = ?`
        const clienteResult = await executeQuery(connection, clienteQuery, [results[0].didCliente])
        if (clienteResult.length > 0) {
            cliente = clienteResult[0].nombre_fantasia
        }

        if (results.length === 0) return null

        const pedido = {
            id: results[0].id,
            did: results[0].did,
            didEnvio: results[0].didEnvio,
            cliente,
            didCuenta: results[0].didCuenta,
            status: results[0].status,
            flex: results[0].flex,
            number: results[0].number,
            fecha_venta: results[0].fecha_venta,
            observaciones: results[0].observaciones,
            armado: results[0].armado,
            descargado: results[0].descargado,
            fecha_armado: results[0].fecha_armado,
            quien_armado: results[0].quien_armado,
            autofecha: results[0].orden_autofecha,
            ml_shipment_id: results[0].ml_shipment_id,
            ml_pack_id: results[0].ml_pack_id,
            idComprador: results[0].buyer_id,
            usuarioComprador: results[0].buyer_nickname,
            nombreComprador: `${results[0].buyer_name} ${results[0].buyer_last_name}`,
            total: results[0].total_amount,
            seller_id: results[0].seller_id,
            didOt: results[0].didOt,
            items: [],
        }

        for (const row of results) {
            if (row.codigo) {
                pedido.items.push({
                    codigo: row.codigo,
                    imagen: row.imagen,
                    descripcion: row.descripcion,
                    ml_id: row.ml_id,
                    dimensiones: row.dimensions,
                    cantidad: row.cantidad,
                    variacion: row.variacion,
                    seller_sku: row.seller_sku,
                    descargado: row.item_descargado,
                    autofecha: row.item_autofecha,
                    idVariacion: row.variacion,
                    user_product_id: row.user_product_id,
                    variacionAtributos: row.variation_attributes,
                })
            }
        }

        return {
            pedido,
            totalItems,
            totalPages,
            pagina,
            cantidad,
        }
    }

    async getTodasLasOrdenes(connection, pagina = 1, cantidad = 10, filtros = {}) {
        pagina = parseInt(pagina)
        cantidad = parseInt(cantidad)
        if (isNaN(pagina) || pagina < 1) pagina = 1
        if (isNaN(cantidad) || cantidad < 1) cantidad = 10

        const offset = (pagina - 1) * cantidad

        let condiciones = ["o.elim = 0", "o.superado = 0"]
        let valores = []

        if (filtros.cliente) {
            condiciones.push("o.didCliente = ?")
            valores.push(filtros.cliente)
        }

        if (filtros.idVenta) {
            condiciones.push("o.number LIKE ?")
            valores.push(`%${filtros.idVenta}%`)
        }

        if (filtros.comprador) {
            condiciones.push("(o.buyer_name LIKE ? OR o.buyer_last_name LIKE ?)")
            valores.push(`%${filtros.comprador}%`)
            valores.push(`%${filtros.comprador}%`)
        }

        if (filtros.estado) {
            condiciones.push("o.status = ?")
            valores.push(filtros.estado)
        }

        if (filtros.armado) {
            condiciones.push("o.armado = ?")
            valores.push(filtros.armado)
        }

        if (filtros.origen) {
            condiciones.push("o.flex = ?")
            valores.push(filtros.origen)
        }

        const whereClause = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : ""

        const query = `
            SELECT 
                o.did, 
                o.didCliente, 
                DATE_FORMAT(o.fecha_venta, '%d/%m/%Y %H:%i') AS fecha_venta, 
                o.flex, 
                o.number, 
                o.status, 
                o.total_amount,
                o.didOt AS ot,
                IF(o.fecha_armado IS NULL, '', DATE_FORMAT(o.fecha_armado, '%d/%m/%Y %H:%i')) AS fecha_armado,
                CONCAT(o.buyer_name, ' ', o.buyer_last_name) AS comprador
            FROM pedidos o
            ${whereClause}
            ORDER BY o.did DESC
            LIMIT ? OFFSET ?
        `

        const results = await executeQuery(connection, query, [...valores, cantidad, offset])
        for (const orden of results) {
            const clienteId = orden.didCliente
            if (!clientesCache[clienteId]) {
                const clienteQuery = `SELECT nombre_fantasia FROM clientes WHERE did = ?`
                const clienteResult = await executeQuery(connection, clienteQuery, [clienteId])
                if (clienteResult.length > 0) {
                    clientesCache[clienteId] = clienteResult[0].nombre_fantasia
                }
            }
            orden.cliente = clientesCache[clienteId]
            if (orden.ot == 0) {
                orden.ot = ""
            }
        }

        const countQuery = `
            SELECT COUNT(*) AS total 
            FROM pedidos o
            ${whereClause}
        `
        const countResult = await executeQuery(connection, countQuery, valores)
        const total = countResult[0]?.total || 0
        const totalPages = Math.ceil(total / cantidad)
        const datosFormateados = results.map((orden) => ({
            did: orden.did,
            cliente: orden.cliente,
            fecha: orden.fecha_venta,
            origen: orden.flex,
            idVenta: orden.number,
            comprador: orden.comprador,
            estado: orden.status,
            total: orden.total_amount,
            armado: orden.fecha_armado,
            ot: orden.ot,
        }))

        return {
            estado: true,
            message: "Órdenes obtenidas correctamente",
            totalRegistros: total,
            totalPaginas: totalPages,
            pagina,
            cantidad,
            data: datosFormateados,
        }
    }

    async getTodasLasOrdenesV(connection, pagina = 1, cantidad = 10, filtros = {}) {
        pagina = parseInt(pagina)
        cantidad = parseInt(cantidad)
        if (isNaN(pagina) || pagina < 1) pagina = 1
        if (isNaN(cantidad) || cantidad < 1) cantidad = 10

        const offset = (pagina - 1) * cantidad

        // Condiciones básicas
        let condiciones = [`elim = 0`, `superado = 0`]
        let valores = []

        // Filtros aplicables
        if (filtros.ml_shipment_id) {
            condiciones.push(`ml_shipment_id = ?`)
            valores.push(filtros.ml_shipment_id)
        }

        if (filtros.ml_pack_id) {
            condiciones.push(`ml_pack_id = ?`)
            valores.push(filtros.ml_pack_id)
        }

        if (filtros.status) {
            condiciones.push(`status = ?`)
            valores.push(filtros.status)
        }

        if (filtros.flex) {
            condiciones.push(`flex = ?`)
            valores.push(filtros.flex)
        }

        if (filtros.number) {
            condiciones.push(`number = ?`)
            valores.push(filtros.number)
        }

        if (filtros.didCuenta) {
            condiciones.push(`didCuenta = ?`)
            valores.push(filtros.didCuenta)
        }

        if (filtros.fechaInicio && filtros.fechaFin) {
            condiciones.push(`fecha_venta BETWEEN ? AND ?`)
            valores.push(filtros.fechaInicio, filtros.fechaFin)
        }

        const whereClause = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : ""

        const query = `
                SELECT id, did, didEnvio, didCliente, didCuenta, status, flex, 
                        number, fecha_venta, observaciones, armado, descargado, 
                        fecha_armado, quien_armado, autofecha, ml_shipment_id, 
                        ml_id, ml_pack_id, buyer_id, buyer_nickname, 
                        buyer_name, buyer_last_name, total_amount
                FROM pedidos
                ${whereClause}
                ORDER BY id DESC
                LIMIT ? OFFSET ?
                `

        const results = await executeQuery(connection, query, [...valores, cantidad, offset])

        const countQuery = `
                SELECT COUNT(*) AS total 
                FROM pedidos
                ${whereClause}
                `
        const countResult = await executeQuery(connection, countQuery, valores)
        const total = countResult[0]?.total || 0
        const totalPages = Math.ceil(total / cantidad)

        return {
            pedidos: results,
            total,
            totalPages,
            pagina,
            cantidad,
        }
    }

    async delete(connection, did) {
        const deleteQuery = "UPDATE pedidos SET elim = 1 WHERE did = ?"
        await executeQuery(connection, deleteQuery, [did])
        const deleteItemsQuery = "UPDATE pedidos_items SET elim = 1 WHERE didPedido = ? AND superado = 0"
        await executeQuery(connection, deleteItemsQuery, [did])
        const deleteHistorialQuery = "UPDATE pedidos_historial SET elim = 1 WHERE didPedido = ? AND superado = 0 LIMIT 1"
        await executeQuery(connection, deleteHistorialQuery, [did])

        return {
            estado: true,
            message: "Orden eliminada correctamente.",
        }
    }

    // Dentro de la clase Ordenes
    static async esEstadoRepetido(connection, number, nuevoEstado) {
        const query = "SELECT status FROM pedidos WHERE number = ?"
        const result = await executeQuery(connection, query, [number])
        if (result.length === 0) return false // No existe, por lo tanto no es repetido
        return result[0].status === nuevoEstado
    }
}
export default Pedidos
