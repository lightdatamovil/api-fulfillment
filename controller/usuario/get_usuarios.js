import { executeQuery } from "lightdata-tools";

export async function getUsuarios(connection, req) {
    const src = req.query;
    const filtros = {
        perfil: src.perfil,
        nombre: src.nombre,
        apellido: src.apellido,
        email: src.email ?? src.mail,
        pagina: src.pagina,
        usuario: src.usuario,
        habilitado: src.habilitado,
        cantidad: src.cantidad,
    };

    // Excluir al usuario actual
    const didUsuario = (req.user?.id ?? src.didUsuario ?? 0);

    let baseQuery = "FROM usuarios WHERE superado = 0 AND elim = 0 AND did != ?";
    const params = [didUsuario];
    const countParams = [didUsuario];

    // Filtros
    if (filtros.perfil !== undefined && filtros.perfil !== "") {
        baseQuery += " AND perfil = ?";
        params.push(filtros.perfil);
        countParams.push(filtros.perfil);
    }

    if (filtros.nombre) {
        baseQuery += " AND nombre LIKE ?";
        params.push(`%${filtros.nombre}%`);
        countParams.push(`%${filtros.nombre}%`);
    }

    if (filtros.apellido) {
        baseQuery += " AND apellido LIKE ?";
        params.push(`%${filtros.apellido}%`);
        countParams.push(`%${filtros.apellido}%`);
    }

    if (filtros.email) {
        baseQuery += " AND mail LIKE ?";
        params.push(`%${filtros.email}%`);
        countParams.push(`%${filtros.email}%`);
    }

    if (filtros.usuario) {
        baseQuery += " AND usuario LIKE ?";
        params.push(`%${filtros.usuario}%`);
        countParams.push(`%${filtros.usuario}%`);
    }

    // habilitado: acepta 0/1 o true/false o "0"/"1"
    if (filtros.habilitado !== undefined && filtros.habilitado !== "") {
        const h =
            typeof filtros.habilitado === "boolean"
                ? (filtros.habilitado ? 1 : 0)
                : Number(filtros.habilitado);
        baseQuery += " AND habilitado = ?";
        params.push(h);
        countParams.push(h);
    }

    // Paginación
    const pagina = Number.parseInt(filtros.pagina, 10);
    const page = Number.isFinite(pagina) && pagina > 0 ? pagina : 1;

    const cant = Number.parseInt(filtros.cantidad, 10);
    const perPageRaw = Number.isFinite(cant) && cant > 0 ? cant : 10;
    const perPage = Math.min(perPageRaw, 100); // límite de seguridad
    const offset = (page - 1) * perPage;

    // Consulta de datos
    const query = `
    SELECT did, perfil, nombre, apellido, mail, usuario, habilitado,
           modulo_inicial, app_habilitada, telefono, codigo_cliente
    ${baseQuery}
    ORDER BY did DESC
    LIMIT ? OFFSET ?
  `;
    const dataParams = [...params, perPage, offset];
    const results = await executeQuery(connection, query, dataParams);

    // Conteo total
    const countQuery = `SELECT COUNT(*) AS total ${baseQuery}`;
    const countResult = await executeQuery(connection, countQuery, countParams);
    const totalRegistros = Number(countResult[0]?.total ?? 0);
    const totalPaginas = Math.ceil(totalRegistros / perPage);

    return {
        usuarios: results,
        pagina: page,
        totalRegistros,
        totalPaginas,
        cantidad: perPage,
    };
}
