import { executeQuery } from "lightdata-tools";

/**
 * GET /clientes (con filtros y paginación)
 * Query params: nombre_fantasia, codigo, razon_social, habilitado, pagina, cantidad
 * Estructura de respuesta: { success, message, data, meta }
 */
export async function getFilteredClientes(connection, req) {
    // -------- helpers de parseo --------
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

    // -------- filtros normalizados --------
    const filtros = {
        nombre_fantasia: toStr(q.nombre_fantasia),
        codigo: toStr(q.codigo),
        razon_social: toStr(q.razon_social),
        pagina: toInt(q.pagina, 1),
        cantidad: toInt(q.cantidad, 10),
    };

    // -------- paginación --------
    const page = Math.max(1, filtros.pagina || 1);
    const pageSize = Math.max(1, Math.min(filtros.cantidad || 10, 100));
    const offset = (page - 1) * pageSize;

    // -------- builder de condiciones --------
    const where = ["c.superado = 0", "c.elim = 0"];
    const params = [];
    const add = (cond, val) => { where.push(cond); params.push(val); };

    if (filtros.nombre_fantasia) add("LOWER(c.nombre_fantasia) LIKE ?", `%${filtros.nombre_fantasia.toLowerCase()}%`);
    if (filtros.codigo) add("LOWER(c.codigo) LIKE ?", `%${filtros.codigo.toLowerCase()}%`);
    if (filtros.razon_social) add("LOWER(c.razon_social) LIKE ?", `%${filtros.razon_social.toLowerCase()}%`);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // -------- total --------
    const countSql = `SELECT COUNT(*) AS total FROM clientes c ${whereSql}`;
    const [{ total: totalItems = 0 } = {}] = await executeQuery(connection, countSql, params);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

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
    ORDER BY c.did DESC
    LIMIT ? OFFSET ?
  `;
    const clientes = await executeQuery(connection, dataSql, [...params, pageSize, offset]);

    if (clientes.length === 0) {
        return {
            success: true,
            message: "Clientes obtenidos correctamente",
            data: [],
            meta: {
                timestamp: new Date().toISOString(),
                page,
                pageSize,
                totalPages,
                totalItems,
                // sin filtros en meta si no aplicaron
            },
        };
    }

    // -------- direcciones y contactos (por didCliente) --------
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

    const clientesFinal = clientes.map((c) => {
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

// ------------- helper meta -------------
function pickNonEmpty(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) continue;
        if (typeof v === "string" && v.trim() === "") continue;
        out[k] = v;
    }
    return out;
}
