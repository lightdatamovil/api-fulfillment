import { executeQuery } from "lightdata-tools";

/**
 * GET /atributos
 * Filtros soportados (query): nombre, codigo, habilitado, pagina, cantidad, sortBy, sortDir
 */
export async function getFilteredAtributos(connection, req) {
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
        codigo: toStr(q.codigo),
        habilitado: toBool(q.habilitado, undefined), // 0/1 o undefined
        pagina: toInt(q.pagina, 1),
        cantidad: toInt(q.cantidad, 10),
    };

    // ---------- paginación ----------
    const page = Math.max(1, filtros.pagina || 1);
    const perPage = Math.max(1, Math.min(filtros.cantidad || 10, 100));
    const offset = (page - 1) * perPage;

    // ---------- builder de condiciones ----------
    const where = ["elim = 0", "superado = 0"];
    const params = [];

    const add = (cond, val) => {
        where.push(cond);
        params.push(val);
    };

    if (filtros.habilitado !== undefined) add("habilitado = ?", filtros.habilitado);
    if (filtros.codigo) add("LOWER(codigo) LIKE ?", `%${filtros.codigo.toLowerCase()}%`);
    if (filtros.nombre) add("LOWER(nombre) LIKE ?", `%${filtros.nombre.toLowerCase()}%`);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // ---------- orden seguro (whitelist) ----------
    const sortBy = toStr(q.sortBy);
    const sortDir = (toStr(q.sortDir) || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortMap = {
        id: "id",
        did: "did",
        nombre: "nombre",
        codigo: "codigo",
        habilitado: "habilitado",
        orden: "orden",
        autofecha: "autofecha",
    };
    const orderSql = `ORDER BY ${sortMap[sortBy] || "did"} ${sortDir}`;

    // ---------- count ----------
    const countSql = `SELECT COUNT(*) AS total FROM atributos ${whereSql}`;
    const [{ total: totalRegistros = 0 } = {}] = await executeQuery(connection, countSql, params);
    const totalPaginas = Math.ceil(totalRegistros / perPage);

    // ---------- data ----------
    const dataSql = `
    SELECT
      id, did, nombre, codigo, descripcion, habilitado, autofecha, orden
    FROM atributos
    ${whereSql}
    ${orderSql}
    LIMIT ? OFFSET ?
  `;
    const dataParams = [...params, perPage, offset];
    const atributos = await executeQuery(connection, dataSql, dataParams);

    return {
        totalRegistros,
        totalPaginas,
        pagina: page,
        cantidad: perPage,
        atributos,
    };
}
