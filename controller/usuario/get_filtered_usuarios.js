import { executeQuery } from "lightdata-tools";

/**
 * GET /usuarios
 * Filtros soportados (query): nombre, usuario, apellido, email, perfil, pagina, habilitado, cantidad
 */
export async function getFilteredUsuarios(connection, req) {
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
        email: toStr(q.email),
        perfil: toInt(q.perfil, undefined),
        habilitado: toBool(q.habilitado, undefined), // 0/1 o undefined
        page: toInt(q.page, 1),
        page_size: toInt(q.page_size, 10),
    };

    // clamp de paginación
    const page = Math.max(1, filtros.page || 1);
    const pageSize = Math.max(1, Math.min(filtros.page_size || 10, 100));
    const offset = (page - 1) * pageSize;

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
    const sortBy = toStr(q.sort_by);
    const sortDir = (toStr(q.sort_dir) || "asc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortMap = {
        nombre: "nombre",
        apellido: "apellido",
        email: "email",
        perfil: "perfil",
        habilitado: "habilitado",
        usuario: "usuario"
    };
    const orderSql = `ORDER BY ${sortMap[sortBy] || "nombre"} ${sortDir}`;

    // ---------- data ----------
    const dataSql = `
        SELECT
          did, perfil, nombre, apellido, mail as email, usuario, habilitado,
          modulo_inicial, app_habilitada, telefono, codigo_cliente
        FROM usuarios
        ${whereSql}
        ${orderSql}
        LIMIT ? OFFSET ?
    
    `;
    const dataParams = [...params, pageSize, offset];
    const results = await executeQuery(connection, dataSql, dataParams);

    // ---------- count ----------
    const countSql = `SELECT COUNT(*) AS total FROM usuarios ${whereSql}`;
    const [{ total: totalItems = 0 } = {}] = await executeQuery(connection, countSql, params);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    // ---------- filters en meta (solo definidos y útiles) ----------
    const filtersForMeta = {};
    for (const k of ["nombre", "usuario", "apellido", "email", "perfil", "habilitado"]) {
        if (filtros[k] !== undefined && filtros[k] !== null && String(filtros[k]).length) {
            filtersForMeta[k] = filtros[k];
        }
    }

    // ---------- respuesta estándar ----------
    return {
        success: true,
        message: "Usuarios obtenidos correctamente",
        data: results,
        meta: {
            timestamp: new Date().toISOString(),
            page,
            pageSize,
            totalPages,
            totalItems,
            ...(Object.keys(filtersForMeta).length > 0 ? { filters: filtersForMeta } : {})
        }
    };
}
