import { executeQuery } from "lightdata-tools";

export async function getFilteredProductos(dbConnection, req) {
    // acepta filtros por querystring o body
    const filtros = Object.keys(req.query || {}).length ? req.query : req.body || {};

    const conditions = ["p.elim = 0", "p.superado = 0"];
    const values = [];

    const page = toInt(filtros.page, 1);
    const pageSize = Math.min(toInt(filtros.pageSize, 10), 200);
    const offset = (page - 1) * pageSize;

    // --- filtros ---
    // título del producto
    if (isNonEmptyString(filtros.titulo)) {
        conditions.push("p.titulo LIKE ? ESCAPE '\\\\'");
        values.push(`%${escapeLike(filtros.titulo)}%`);
    }

    // nombre del cliente (acepto varias claves comunes)
    const nombreCliente =
        firstNonEmpty(filtros.nombreCliente);
    if (isNonEmptyString(nombreCliente)) {
        conditions.push("c.nombre_fantasia LIKE ? ESCAPE '\\\\'");
        values.push(`%${escapeLike(nombreCliente)}%`);
    }

    // habilitado (0/1) o "todos"
    if (
        filtros.habilitado !== null &&
        filtros.habilitado !== undefined &&
        filtros.habilitado !== "todos" &&
        filtros.habilitado !== ""
    ) {
        const hab = Number(filtros.habilitado);
        if (hab === 0 || hab === 1) {
            conditions.push("p.habilitado = ?");
            values.push(hab);
        }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // --- total ---
    const totalQuery = `
    SELECT COUNT(*) AS total
    FROM productos p
    JOIN clientes c ON c.did = p.didCliente
    ${whereClause}
  `;
    const totalResult = await executeQuery(dbConnection, totalQuery, values);
    const totalItems = Number(totalResult?.[0]?.total || 0);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    // --- data ---
    const dataQuery = `
    SELECT
      p.did,
      c.nombre_fantasia AS cliente,
      p.titulo,
      p.habilitado
    FROM productos p
    JOIN clientes c ON c.did = p.didCliente
    ${whereClause}
    ORDER BY p.did DESC
    LIMIT ? OFFSET ?
  `;
    const dataValues = [...values, Number(pageSize), Number(offset)];
    const results = await executeQuery(dbConnection, dataQuery, dataValues);

    const filtersForMeta = pickNonEmpty({
        titulo: filtros.titulo,
        nombre_cliente: nombreCliente,
        ...(filtros.habilitado !== "todos" && filtros.habilitado !== "" && filtros.habilitado !== undefined
            ? { habilitado: isFinite(Number(filtros.habilitado)) ? Number(filtros.habilitado) : filtros.habilitado }
            : {})
    });

    return {
        success: true,
        message: "Productos obtenidos correctamente",
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

// --- helpers (mismos que ya usás + uno nuevo) ---
const toInt = (v, def) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : def;
};

const escapeLike = (s) =>
    String(s)
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");

const isNonEmptyString = (v) => typeof v === "string" && v.trim() !== "";

function pickNonEmpty(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) continue;
        if (typeof v === "string" && v.trim() === "") continue;
        out[k] = v;
    }
    return out;
}

function firstNonEmpty(...vals) {
    for (const v of vals) {
        if (typeof v === "string" && v.trim() !== "") return v;
    }
    return undefined;
}