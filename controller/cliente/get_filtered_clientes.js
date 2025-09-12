import { executeQuery, toStr, toBool, toInt, pickNonEmpty } from "lightdata-tools";

/**
 * GET /clientes (con filtros, orden y paginación)
 * Query params:
 *  - nombre_fantasia, codigo, razon_social
 *  - estado / habilitado: 0 (deshabilitado), 1 (habilitado), vacío = todos
 *  - page / page_size  (alias: pagina / cantidad)
 *  - sort_by: codigo | nombre_fantasia | razon_social | estado
 *  - sort_dir: asc | desc
 * Respuesta: { success, message, data, meta }
 */
export async function getFilteredClientes(connection, req) {
    // -------- helpers de parseo (alineado a /usuarios) --------
    const q = req.query;

    // -------- filtros normalizados --------
    const filtros = {
        nombre_fantasia: toStr(q.nombre_fantasia),
        codigo: toStr(q.codigo),
        razon_social: toStr(q.razon_social),
        // aceptar 'estado' o 'habilitado' como sinónimos
        habilitado: toBool(q.estado ?? q.habilitado, undefined),
        page: toInt(q.page ?? q.pagina, 1),
        page_size: toInt(q.page_size ?? q.cantidad, 10),
    };

    // -------- paginación (como en usuarios) --------
    const page = Math.max(1, filtros.page || 1);
    const pageSize = Math.max(1, Math.min(filtros.page_size || 10, 100));
    const offset = (page - 1) * pageSize;

    // -------- builder de condiciones --------
    const where = ["c.superado = 0", "c.elim = 0"];
    const params = [];
    const add = (cond, ...vals) => { where.push(cond); params.push(...vals); };

    if (filtros.nombre_fantasia) add("LOWER(c.nombre_fantasia) LIKE ?", `%${filtros.nombre_fantasia.toLowerCase()}%`);
    if (filtros.codigo) add("LOWER(c.codigo)           LIKE ?", `%${filtros.codigo.toLowerCase()}%`);
    if (filtros.razon_social) add("LOWER(c.razon_social)     LIKE ?", `%${filtros.razon_social.toLowerCase()}%`);
    if (filtros.habilitado !== undefined) add("c.habilitado = ?", filtros.habilitado);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // -------- orden seguro (whitelist) --------
    const sortBy = toStr(q.sort_by);
    const sortDir = (toStr(q.sort_dir) || "asc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortMap = {
        codigo: "c.codigo",
        nombre_fantasia: "c.nombre_fantasia",
        razon_social: "c.razon_social",
        estado: "c.habilitado",
    };
    const orderSql = `ORDER BY ${sortMap[sortBy] || "c.nombre_fantasia"} ${sortDir}`;

    // -------- total --------
    const countSql = `SELECT COUNT(*) AS total FROM clientes c ${whereSql}`;
    const [{ total: totalItems = 0 } = {}] = await executeQuery(connection, countSql, params);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    // -------- data base (clientes) --------
    const dataSql = `
    SELECT
      c.did,
      c.nombre_fantasia,
      c.habilitado,
      c.codigo,
      c.observaciones,
      c.razon_social,
      c.quien
    FROM clientes c
    ${whereSql}
    ${orderSql}
    LIMIT ? OFFSET ?
  `;
    const clientes = await executeQuery(connection, dataSql, [...params, pageSize, offset]);

    // -------- direcciones y contactos (por didCliente) --------
    let clientesFinal = [];
    if (clientes.length > 0) {
        const dids = clientes.map(c => c.did);
        const placeholders = dids.map(() => "?").join(",");

        const direccionesSql = `
      SELECT did, didCliente, data
      FROM clientes_direcciones
      WHERE elim = 0 AND superado = 0 AND didCliente IN (${placeholders})
    `;
        const direcciones = await executeQuery(connection, direccionesSql, dids);

        const contactosSql = `
      SELECT did, didCliente, tipo, valor
      FROM clientes_contactos
      WHERE elim = 0 AND superado = 0 AND didCliente IN (${placeholders})
    `;
        const contactos = await executeQuery(connection, contactosSql, dids);

        clientesFinal = clientes.map((c) => {
            const cliDirs = direcciones
                .filter(d => d.didCliente === c.did)
                .map(d => ({ did: d.did, data: d.data }));

            const cliConts = contactos
                .filter(k => k.didCliente === c.did)
                .map(k => ({ did: k.did, tipo: k.tipo, valor: k.valor }));

            return {
                did: c.did,
                nombre_fantasia: c.nombre_fantasia,
                habilitado: c.habilitado,
                codigo: c.codigo,
                observaciones: c.observaciones,
                razon_social: c.razon_social,
                quien: c.quien,
                contactos: cliConts,
                direcciones: cliDirs,
            };
        });
    }

    // -------- meta.filters solo si hay --------
    const filtersForMeta = pickNonEmpty({
        nombre_fantasia: filtros.nombre_fantasia,
        codigo: filtros.codigo,
        razon_social: filtros.razon_social,
        ...(filtros.habilitado !== undefined ? { habilitado: filtros.habilitado } : {}),
    });

    return {
        success: true,
        message: "Clientes obtenidos correctamente",
        data: clientesFinal,
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