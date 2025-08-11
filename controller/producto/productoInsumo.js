const { executeQuery } = require("lightdata-tools")

class ProductoInsumo {
    constructor(
        did = "",
        didProducto = 0,
        didInsumo = 0,
        cantidad = 0,
        habilitado = 0,
        quien = 0,
        superado = 0,
        elim = 0,
        connection = null
    ) {
        this.did = did
        this.didProducto = didProducto
        this.didInsumo = didInsumo
        this.cantidad = cantidad
        this.habilitado = habilitado
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
        const checkDidProductoQuery = "SELECT did FROM productos_insumos WHERE didProducto = ? AND didInsumo = ? AND elim = 0 AND superado = 0"
        const results = await executeQuery(connection, checkDidProductoQuery, [this.didProducto, this.didInsumo])

        if (results.length > 0) {
            const updateQuery = "UPDATE productos_insumos SET superado = 1 WHERE did = ?"
            await executeQuery(connection, updateQuery, [results[0].did])
            return this.createNewRecord2(connection, [results[0].did])
        } else {
            return this.createNewRecord(connection)
        }
    }

    async createNewRecord(connection) {
        const columnsQuery = "DESCRIBE productos_insumos"
        const results = await executeQuery(connection, columnsQuery, [])

        const tableColumns = results.map((column) => column.Field)
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined)

        const values = filteredColumns.map((column) => this[column])
        const insertQuery = `INSERT INTO productos_insumos (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`

        const insertResult = await executeQuery(connection, insertQuery, values)

        if (this.did == 0 || this.did == null) {
            const updateQuery = "UPDATE productos_insumos SET did = ? WHERE id = ?"
            await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId])
        }

        return { insertId: insertResult.insertId }
    }

    async createNewRecord2(connection, did) {
        const columnsQuery = "DESCRIBE productos_variantes"
        const results = await executeQuery(connection, columnsQuery, [])

        const tableColumns = results.map((column) => column.Field)
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined)

        const values = filteredColumns.map((column) => {
            const val = this[column]
            if (typeof val === "object" && val !== null) {
                return JSON.stringify(val)
            }
            return val
        })

        const insertQuery = `INSERT INTO productos_variantes (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`
        const insertResult = await executeQuery(connection, insertQuery, values)

        const updateQuery = "UPDATE productos_variantes SET did = ? WHERE id = ?"
        await executeQuery(connection, updateQuery, [did, insertResult.insertId])

        return { insertId: insertResult.insertId }
    }

    async delete(connection, did) {
        const deleteQuery = "UPDATE usuarios SET elim = 1 WHERE did = ?"
        await executeQuery(connection, deleteQuery, [did])
        return {
            estado: true,
            message: "Producto eliminado correctamente.",
        }
    }
    async deleteMissing(connection, didAtributo, didsActuales = []) {
        if (!Array.isArray(didsActuales)) {
            didsActuales = []
        }

        let deleteQuery = ""
        let params = []

        if (didsActuales.length > 0) {
            deleteQuery = `
        UPDATE productos_insumos
        SET elim = 1
        WHERE didProducto = ? AND did NOT IN (${didsActuales.map(() => "?").join(", ")}) AND elim = 0
      `
            params = [didAtributo, ...didsActuales]
        } else {
            // Si el array está vacío, eliminar todos los registros del atributo
            deleteQuery = `
        UPDATE productos_insumos
        SET elim = 1
        WHERE didProducto = ? AND elim = 0
      `
            params = [didAtributo]
        }

        await executeQuery(connection, deleteQuery, params)
    }
    static async getUsuarios(connection, filtros = {}) {
        let baseQuery = "FROM usuarios WHERE superado = 0 AND elim = 0"
        const params = []
        const countParams = []

        if (filtros.perfil !== undefined && filtros.perfil !== "") {
            baseQuery += " AND perfil = ?"
            params.push(filtros.perfil)
            countParams.push(filtros.perfil)
        }

        if (filtros.nombre) {
            baseQuery += " AND nombre LIKE ?"
            params.push(`%${filtros.nombre}%`)
            countParams.push(`%${filtros.nombre}%`)
        }

        if (filtros.apellido) {
            baseQuery += " AND apellido LIKE ?"
            params.push(`%${filtros.apellido}%`)
            countParams.push(`%${filtros.apellido}%`)
        }

        if (filtros.email) {
            baseQuery += " AND mail LIKE ?"
            params.push(`%${filtros.email}%`)
            countParams.push(`%${filtros.email}%`)
        }
        if (filtros.usuario) {
            baseQuery += " AND usuario LIKE ?"
            params.push(`%${filtros.usuario}%`)
            countParams.push(`%${filtros.usuario}%`)
        }
        if (filtros.habilitado != "") {

            baseQuery += " AND habilitado = ?"
            params.push(filtros.habilitado)
            countParams.push(filtros.habilitado)
        }

        // Paginación
        const pagina = parseInt(filtros.pagina) || 1
        const porPagina = filtros.cantidad || 10
        const offset = (pagina - 1) * porPagina

        // Consulta principal con LIMIT
        const query = `SELECT did,perfil,nombre,apellido,mail,usuario,habilitado,modulo_inicial, app_habilitada, codigo_cliente ${baseQuery} ORDER BY did DESC LIMIT ? OFFSET ?`
        params.push(porPagina, offset)
        const results = await executeQuery(connection, query, params)

        // Consulta para contar total de usuarios con filtros
        const countQuery = `SELECT COUNT(*) AS total ${baseQuery}`
        const countResult = await executeQuery(connection, countQuery, countParams)
        const totalRegistros = countResult[0]?.total || 0
        const totalPaginas = Math.ceil(totalRegistros / porPagina)

        // Remover contraseña
        const usuariosSinPass = results.map((usuario) => {
            delete usuario.pass
            return usuario
        })

        return {
            usuarios: usuariosSinPass,
            pagina: pagina,
            totalRegistros,
            totalPaginas,
            cantidad: porPagina,
        }
    }

    static async getUsuariosById(connection, id) {
        const query = "SELECT perfil,nombre,apellido,mail,usuario,habilitado,did, modulo_inicial, app_habilitada, codigo_cliente FROM usuarios WHERE did = ? AND superado = 0 AND  elim = 0"
        const params = [id]
        const results = await executeQuery(connection, query, params)

        // Remover contraseña
        const usuariosSinPass = results.map((usuario) => {
            delete usuario.pass
            return usuario
        })

        return usuariosSinPass
    }
}

module.exports = ProductoInsumo
