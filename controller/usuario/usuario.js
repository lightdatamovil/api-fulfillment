import { createHash } from "crypto"
import { sign } from "jsonwebtoken"
import { executeQuery } from "lightdata-tools"
const JWT_SECRET = "tu_clave_secreta"

class Usuario {
    constructor(
        did = "",
        nombre = "",
        apellido = "",
        mail = "",
        usuario = "",
        pass = "",
        imagen = "",
        habilitado = 0,
        perfil = 0,
        accesos = "",
        modulo_inicial = 0,
        app_habilitada = 0,
        codigo_cliente = "",
        telefono = "",
        quien = 0,
        superado = 0,
        elim = 0,
        connection = null
    ) {
        this.did = did
        this.nombre = nombre
        this.apellido = apellido
        this.mail = mail
        this.usuario = usuario
        this.imagen = imagen

        this.pass = pass

        this.habilitado = habilitado
        this.perfil = perfil
        this.accesos = accesos
        this.quien = quien || 0
        this.modulo_inicial = modulo_inicial || 0
        this.app_habilitada = app_habilitada || 0
        this.codigo_cliente = codigo_cliente || ""
        this.telefono = telefono || ""

        this.superado = superado || 0
        this.elim = elim || 0
        this.connection = connection
    }

    toJSON() {
        return JSON.stringify(this)
    }

    async insert() {
        try {
            if (!this.did || this.did == 0) {
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
        const checkDidProductoQuery = "SELECT id, pass FROM usuarios WHERE did = ?  and superado = 0 AND elim = 0"
        const results = await executeQuery(connection, checkDidProductoQuery, [this.did])

        if (results.length > 0) {
            if (!this.pass || this.pass.trim() == "") {
                this.pass = results[0].pass
            } else {

                const hash = createHash("sha256").update(this.pass).digest("hex")
                this.pass = hash
            }

            const queryUpdate = "UPDATE usuarios SET superado = 1 WHERE did = ?"
            await executeQuery(connection, queryUpdate, [this.did])
            return this.createNewRecord(connection)
        }
        return {
            estado: false,
            mensaje: "El usuario no existe",
        }
    }

    async createNewRecord(connection) {
        const querycheck = "SELECT usuario FROM usuarios WHERE usuario = ? AND superado = 0 AND elim = 0"
        const resultscheck = await executeQuery(connection, querycheck, [this.usuario])

        if (resultscheck.length > 0) {
            return {
                estado: false,
                message: "El usuario ya existe.",
            }
        }

        const columnsQuery = "DESCRIBE usuarios"
        const results = await executeQuery(connection, columnsQuery, [])

        const tableColumns = results.map((column) => column.Field)
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined)

        const values = filteredColumns.map((column) => this[column])
        const insertQuery = `INSERT INTO usuarios (${filteredColumns.join(", ")}) VALUES (${filteredColumns.map(() => "?").join(", ")})`

        const insertResult = await executeQuery(connection, insertQuery, values)

        if (this.did == 0 || this.did == null || this.did === "") {
            const updateQuery = "UPDATE usuarios SET did = ? WHERE id = ?"
            await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId])
        }

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

    static async getUsuarios(connection, didUsuario, filtros = {}) {
        let baseQuery = "FROM usuarios WHERE superado = 0 AND elim = 0 AND did =! ?"
        const params = [didUsuario]
        const countParams = [didUsuario]

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

        const pagina = parseInt(filtros.pagina) || 1
        const porPagina = filtros.cantidad || 10
        const offset = (pagina - 1) * porPagina

        const query = `SELECT did,perfil,nombre,apellido,mail,usuario,habilitado,modulo_inicial, app_habilitada,telefono, codigo_cliente ${baseQuery} ORDER BY did DESC LIMIT ? OFFSET ?`
        params.push(porPagina, offset)
        const results = await executeQuery(connection, query, params)

        const countQuery = `SELECT COUNT(*) AS total ${baseQuery}`
        const countResult = await executeQuery(connection, countQuery, countParams)
        const totalRegistros = countResult[0]?.total || 0
        const totalPaginas = Math.ceil(totalRegistros / porPagina)

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
        const query = "SELECT perfil,nombre,apellido,mail,usuario,habilitado,did, modulo_inicial, app_habilitada,telefono, codigo_cliente FROM usuarios WHERE did = ? AND superado = 0 AND  elim = 0"
        const params = [id]
        const results = await executeQuery(connection, query, params)

        const usuariosSinPass = results.map((usuario) => {
            delete usuario.pass
            return usuario
        })

        return usuariosSinPass
    }

    async login(connection, usuario, password, codigo = null) {
        const empresaQuery = "SELECT * FROM sistema_empresa WHERE codigo = ? AND superado = 0 AND elim = 0"
        const empresaResult = await executeQuery(connection, empresaQuery, [codigo])

        if (empresaResult.length === 0) {
            return { estado: false, mensaje: "Código de empresa inválido" }
        }

        let query = `
      SELECT u.* 
      FROM usuarios u
      WHERE u.usuario = ? AND u.elim = 0 AND u.superado = 0 AND u.habilitado = 1
    `
        const params = [usuario]

        if (codigo) {
            query += " AND EXISTS (SELECT 1 FROM sistema_empresa se WHERE se.codigo = ?)"
            params.push(codigo)
        }

        const results = await executeQuery(connection, query, params)

        if (results.length === 0) {
            return {
                estado: false,
                mensaje: "Usuario no encontrado o código inválido",
            }
        }

        const user = results[0]

        const hashCalculado = user.pass

        if (hashCalculado === password) {
            delete user.pass

            const token = sign(
                {
                    did: user.did,
                    perfil: user.perfil,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    mail: user.mail,
                    username: user.usuario,
                    quien: user.did,
                    empresa: codigo,
                    idEmpresa: empresaResult[0].did,
                    tipo: empresaResult[0].tipo,
                },
                JWT_SECRET,
                {
                    expiresIn: "8h",
                }
            )

            return {
                estado: true,
                mensaje: "Login correcto",
                did: user.did,
                quien: user.did,
                perfil: user.perfil,
                nombre: user.nombre,
                apellido: user.apellido,
                mail: user.mail,
                username: user.usuario,
                empresa: codigo,
                didEmpresa: empresaResult[0].did,
                tipo: empresaResult[0].tipo,
                token: token,
            }
        } else {
            return { estado: false, mensaje: "Contraseña incorrecta" }
        }
    }
}

export default Usuario
