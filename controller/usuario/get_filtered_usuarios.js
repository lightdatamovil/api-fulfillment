import { executeQuery } from "lightdata-tools";

/**
 * GET /usuarios
 * Filtros soportados (query): nombre, usuario, apellido, email|mail, perfil, pagina, habilitado, cantidad
 */
export async function getUsuarios(connection, req) {
    // ---------- helpers de parseo ----------
    const q = req.query;

    const pick = (v) => (Array.isArray(v) ? v[0] : v);
    const toStr = (v) => {
        const s = pick(v);
        if (s === undefined || s === null) return undefined;
        const t = String(s).trim();
        return t.length ? t : undefined;
    };
    const toInt = (v, def) => {
        const n = parseInt(pick(v) ?? "", 10);
        return Number.isFinite(n) ? n : def;
    };
    const toBool = (v, def) => {
        const s = String(pick(v) ?? "").toLowerCase();
        if (["true", "1", "yes", "si", "on"].includes(s)) return 1;
        if (["false", "0", "no", "off"].includes(s)) return 0;
        return def;
    };

    // ---------- filtros normalizados ----------
    const filtros = {
        nombre: toStr(q.nombre),
        usuario: toStr(q.usuario),
        apellido: toStr(q.apellido),
        email: toStr(q.email ?? q.mail),
        perfil: toInt(q.perfil, undefined),
        pagina: toInt(q.pagina, 1),
        habilitado: toBool(q.habilitado, undefined), // devuelve 0/1 o undefined
        cantidad: toInt(q.cantidad, 10),
    };

    // clamp de paginación
    const page = Math.max(1, filtros.pagina || 1);
    const perPage = Math.max(1, Math.min(filtros.cantidad || 10, 100));
    const offset = (page - 1) * perPage;

    // ---------- excluir usuario actual ----------
    const didActual = Number(req.user?.userId ?? q.didUsuario ?? 0) || 0;

    // ---------- builder de condiciones ----------
    const where = ["superado = 0", "elim = 0", "did <> ?"];
    const params = [didActual];

    const add = (cond, val) => {
        where.push(cond);
        params.push(val);
    };

    if (filtros.perfil !== undefined) add("perfil = ?", filtros.perfil);
    if (filtros.nombre) add("LOWER(nombre)  LIKE ?", `%${filtros.nombre.toLowerCase()}%`);
    if (filtros.apellido) add("LOWER(apellido) LIKE ?", `%${filtros.apellido.toLowerCase()}%`);
    if (filtros.email) add("LOWER(mail)    LIKE ?", `%${filtros.email.toLowerCase()}%`);
    if (filtros.usuario) add("LOWER(usuario) LIKE ?", `%${filtros.usuario.toLowerCase()}%`);
    if (filtros.habilitado !== undefined) add("habilitado = ?", filtros.habilitado);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // ---------- orden seguro (whitelist) ----------
    // Si querés ordenar por query (?sortBy=did&sortDir=desc), hacelo con whitelist para evitar inyecciones:
    const sortBy = toStr(q.sortBy);
    const sortDir = (toStr(q.sortDir) || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortMap = {
        did: "did",
        nombre: "nombre",
        apellido: "apellido",
        usuario: "usuario",
        mail: "mail",
        perfil: "perfil",
        habilitado: "habilitado",
    };
    const orderSql = `ORDER BY ${sortMap[sortBy] || "did"} ${sortDir}`;

    // ---------- data ----------
    const dataSql = `
    SELECT
      did, perfil, nombre, apellido, mail, usuario, habilitado,
      modulo_inicial, app_habilitada, telefono, codigo_cliente
    FROM usuarios
    ${whereSql}
    ${orderSql}
    LIMIT ? OFFSET ?
  `;
    const dataParams = [...params, perPage, offset];
    const usuarios = await executeQuery(connection, dataSql, dataParams);

    // ---------- count ----------
    const countSql = `SELECT COUNT(*) AS total FROM usuarios ${whereSql}`;
    const [{ total: totalRegistros = 0 } = {}] = await executeQuery(connection, countSql, params);
    const totalPaginas = Math.ceil(totalRegistros / perPage);

    return {
        usuarios,
        pagina: page,
        totalRegistros,
        totalPaginas,
        cantidad: perPage,
    };
}
