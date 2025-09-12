import { executeQuery, toStr, toBool01, toInt, pickNonEmpty } from "lightdata-tools";

/**
 * GET /variantes (con filtros y paginación)
 * Query params: nombre, codigo, habilitado, pagina, cantidad, sortBy, sortDir
 * Estructura de respuesta: { success, message, data, meta }
 */
export async function getFilteredVariantes(connection, req) {
    // ---------- helpers de parseo ----------
    const q = req.query;


    // ---------- filtros normalizados ----------
    const filtros = {
        nombre: toStr(q.nombre),
        codigo: toStr(q.codigo),
        habilitado: toBool01(q.habilitado), // 0/1 o undefined
        page: toInt(q.page, 1),
        page_size: toInt(q.page_size, 10),
    };

    // ---------- paginación ----------
    const page = Math.max(1, filtros.page || 1);
    const pageSize = Math.max(1, Math.min(filtros.page_size || 10, 100));
    const offset = (page - 1) * pageSize;

    // ---------- builder de condiciones ----------
    const where = ["elim = 0", "superado = 0"];
    const params = [];
    const add = (cond, val) => { where.push(cond); params.push(val); };

    if (filtros.habilitado !== undefined) add("habilitado = ?", filtros.habilitado);
    if (filtros.codigo) add("LOWER(codigo) LIKE ?", `%${filtros.codigo.toLowerCase()}%`);
    if (filtros.nombre) add("LOWER(nombre) LIKE ?", `%${filtros.nombre.toLowerCase()}%`);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // ---------- orden seguro (whitelist) ----------
    const sortBy = toStr(q.sort_by);
    const sortDir = (toStr(q.sort_dir) || "asc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortMap = {
        nombre: "nombre",
        codigo: "codigo",
        descripcion: "descripcion",
        habilitado: "habilitado",
    };
    const orderSql = `ORDER BY ${sortMap[sortBy] || "codigo"} ${sortDir}`;

    // ---------- total ----------
    const countSql = `SELECT COUNT(*) AS total FROM atributos ${whereSql}`;
    const [{ total: totalItems = 0 } = {}] = await executeQuery(connection, countSql, params);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    // ---------- data ----------
    const dataSql = `
    SELECT id, did, nombre, codigo, descripcion, habilitado, autofecha, orden
    FROM atributos
    ${whereSql}
    ${orderSql}
    LIMIT ? OFFSET ?
  `;
    const dataParams = [...params, pageSize, offset];
    const variantes = await executeQuery(connection, dataSql, dataParams);

    // ---------- meta.filters solo si hay ----------
    const filtersForMeta = pickNonEmpty({
        nombre: filtros.nombre,
        codigo: filtros.codigo,
        ...(filtros.habilitado !== undefined ? { habilitado: filtros.habilitado } : {}),
    });

    return {
        success: true,
        message: "Variantes obtenidas correctamente",
        data: variantes,
        meta: {
            timestamp: new Date().toISOString(),
            page,
            pageSize,
            totalPages,
            totalItems,
            ...(Object.keys(filtersForMeta).length > 0 ? { filters: filtersForMeta } : {}),
        },
    };
}