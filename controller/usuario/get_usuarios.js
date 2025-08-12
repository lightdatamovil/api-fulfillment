import { executeQuery } from "lightdata-tools"

export async function getUsuarios(connection, req) {
    const body = req.body;
    const filtros = {
        did: body.did,
        perfil: body.perfil,
        nombre: body.nombre,
        apellido: body.apellido,
        email: body.email,
        pagina: body.pagina,
        usuario: body.usuario,
        habilitado: body.habilitado,
        cantidad: body.cantidad,
    };
    const didUsuario = body.didUsuario;
    let baseQuery = "FROM usuarios WHERE superado = 0 AND elim = 0 AND did != ?"
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