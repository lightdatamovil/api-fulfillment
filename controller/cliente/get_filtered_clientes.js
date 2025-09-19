import { executeQuery } from "lightdata-tools";

/**
 * GET /clientes (con filtros y paginación)
 * Query params:
 *   nombre_fantasia, codigo, razon_social, habilitado,
 *   localidad, pais, cp, email, telefono,
 *   pagina, cantidad
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
    const toBoolInt = (v) => {
        const s = toStr(v);
        if (s === undefined) return undefined;
        if (s === "1" || s?.toLowerCase() === "true") return 1;
        if (s === "0" || s?.toLowerCase() === "false") return 0;
        return undefined;
    };

    // -------- filtros normalizados --------
    const filtros = {
        nombre_fantasia: toStr(q.nombre_fantasia),
        codigo: toStr(q.codigo),
        razon_social: toStr(q.razon_social),
        habilitado: toBoolInt(q.habilitado),
        localidad: toStr(q.localidad),
        pais: toStr(q.pais),
        cp: toStr(q.cp),
        email: toStr(q.email),
        telefono: toStr(q.telefono),

        pagina: toInt(q.pagina, 1),
        cantidad: toInt(q.cantidad, 10),
    };

    // -------- paginación --------
    const page = Math.max(1, filtros.pagina || 1);
    const pageSize = Math.max(1, Math.min(filtros.cantidad || 10, 100));
    const offset = (page - 1) * pageSize;

    // -------- builder de condiciones --------
    // Base de clientes
    const baseConds = ["c.superado = 0", "c.elim = 0"];
    const baseParams = [];
    const addBase = (cond, val) => {
        baseConds.push(cond);
        if (Array.isArray(val)) baseParams.push(...val);
        else if (val !== undefined) baseParams.push(val);
    };

    if (filtros.nombre_fantasia)
        addBase("LOWER(c.nombre_fantasia) LIKE ?", `%${filtros.nombre_fantasia.toLowerCase()}%`);
    if (filtros.codigo)
        addBase("LOWER(c.codigo) LIKE ?", `%${filtros.codigo.toLowerCase()}%`);
    if (filtros.razon_social)
        addBase("LOWER(c.razon_social) LIKE ?", `%${filtros.razon_social.toLowerCase()}%`);
    if (filtros.habilitado !== undefined)
        addBase("c.habilitado = ?", filtros.habilitado);

    // Filtros por tablas relacionadas usando EXISTS para no duplicar filas
    const existsConds = [];
    const existsParams = [];

    // Direcciones (clientes_direcciones con did_cliente)
    const dirSubConds = ["d.elim = 0", "d.superado = 0", "d.did_cliente = c.did"];
    const dirSubParams = [];
    if (filtros.localidad) {
        dirSubConds.push("LOWER(d.localidad) LIKE ?");
        dirSubParams.push(`%${filtros.localidad.toLowerCase()}%`);
    }
    if (filtros.pais) {
        dirSubConds.push("LOWER(d.pais) LIKE ?");
        dirSubParams.push(`%${filtros.pais.toLowerCase()}%`);
    }
    if (filtros.cp) {
        dirSubConds.push("LOWER(d.cp) LIKE ?");
        dirSubParams.push(`%${filtros.cp.toLowerCase()}%`);
    }
    if (dirSubParams.length > 0) {
        existsConds.push(
            `EXISTS (SELECT 1 FROM clientes_direcciones d WHERE ${dirSubConds.join(" AND ")})`
        );
        existsParams.push(...dirSubParams);
    }

    // Contactos (clientes_contactos con did_cliente)
    const conSubConds = ["co.elim = 0", "co.superado = 0", "co.did_cliente = c.did"];
    const conSubParams = [];
    if (filtros.email) {
        conSubConds.push("LOWER(co.email) LIKE ?");
        conSubParams.push(`%${filtros.email.toLowerCase()}%`);
    }
    if (filtros.telefono) {
        conSubConds.push("LOWER(co.telefono) LIKE ?");
        conSubParams.push(`%${filtros.telefono.toLowerCase()}%`);
    }
    if (conSubParams.length > 0) {
        existsConds.push(
            `EXISTS (SELECT 1 FROM clientes_contactos co WHERE ${conSubConds.join(" AND ")})`
        );
        existsParams.push(...conSubParams);
    }

    const whereParts = [];
    if (baseConds.length) whereParts.push(baseConds.join(" AND "));
    if (existsConds.length) whereParts.push(existsConds.join(" AND "));
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    // -------- total --------
    const countSql = `SELECT COUNT(*) AS total FROM clientes c ${whereSql}`;
    const countParams = [...baseParams, ...existsParams];
    const [{ total: totalItems = 0 } = {}] = await executeQuery(connection, countSql, countParams);
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
    const clientes = await executeQuery(connection, dataSql, [...countParams, pageSize, offset]);

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
            },
        };
    }

    // -------- direcciones y contactos (por did_cliente) --------
    const dids = clientes.map((c) => c.did);
    const placeholders = dids.map(() => "?").join(",");

    // Direcciones con columnas explícitas y did_cliente
    const direccionesSql = `
    SELECT did, did_cliente, address_line, localidad, pais, cp
    FROM clientes_direcciones
    WHERE elim = 0 AND superado = 0 AND did_cliente IN (${placeholders})
  `;
    const direcciones = await executeQuery(connection, direccionesSql, dids);

    // Contactos con columnas explícitas y did_cliente
    const contactosSql = `
    SELECT did, did_cliente, telefono, email
    FROM clientes_contactos
    WHERE elim = 0 AND superado = 0 AND did_cliente IN (${placeholders})
  `;
    const contactos = await executeQuery(connection, contactosSql, dids);

    const clientesFinal = clientes.map((c) => {
        const cliDirs = direcciones
            .filter((d) => d.did_cliente === c.did)
            .map((d) => ({
                did: d.did,
                address_line: d.address_line,
                localidad: d.localidad,
                pais: d.pais,
                cp: d.cp,
            }));

        const cliConts = contactos
            .filter((k) => k.did_cliente === c.did)
            .map((k) => ({
                did: k.did,
                telefono: k.telefono,
                email: k.email,
            }));

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
        habilitado: filtros.habilitado,
        localidad: filtros.localidad,
        pais: filtros.pais,
        cp: filtros.cp,
        email: filtros.email,
        telefono: filtros.telefono,
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
