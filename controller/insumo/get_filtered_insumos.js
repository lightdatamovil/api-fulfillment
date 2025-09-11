import { executeQuery } from "lightdata-tools";




export async function getFilteredInsumos(dbConnection, req) {
    const filtros = req.query;
    const pick = (v) => (Array.isArray(v) ? v[0] : v);
    const toStr = (v) => {
        const s = pick(v);
        if (s === undefined || s === null) return undefined;
        const t = String(s).trim();
        return t.length ? t : undefined;
    };

    const conditions = ["i.elim = 0", "i.superado = 0"];
    const values = [];

    const page = toInt(filtros.page, 1);
    const pageSize = Math.min(toInt(filtros.pageSize, 10), 200);
    const offset = (page - 1) * pageSize;

    if (isNonEmptyString(filtros.codigo)) {
        conditions.push("i.codigo LIKE ? ESCAPE '\\\\'");
        values.push(`%${escapeLike(filtros.codigo)}%`);
    }

    if (isNonEmptyString(filtros.nombre)) {
        conditions.push("i.nombre LIKE ? ESCAPE '\\\\'");
        values.push(`%${escapeLike(filtros.nombre)}%`);
    }

    if (filtros.habilitado !== null && filtros.habilitado !== undefined && filtros.habilitado !== "todos" && filtros.habilitado !== "") {
        const hab = Number(filtros.habilitado);
        if (hab === 0 || hab === 1) {
            conditions.push("i.habilitado = ?");
            values.push(hab);
        }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const totalQuery = `SELECT COUNT(*) AS total FROM insumos i ${whereClause}`;
    const totalResult = await executeQuery(dbConnection, totalQuery, values);
    const totalItems = Number(totalResult?.[0]?.total || 0);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    // ---------- orden seguro (whitelist) ----------
    const sortBy = toStr(filtros.sort_by);
    const sortDir = (toStr(filtros.sort_dir) || "asc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortMap = {
        nombre: "nombre",
        codigo: "codigo",
        habilitado: "habilitado",
    };
    const orderSql = `ORDER BY ${sortMap[sortBy] || "codigo"} ${sortDir}`;


    const dataQuery = `
    SELECT i.did, i.nombre, i.codigo, i.habilitado
    FROM insumos i
    ${whereClause}
    ${orderSql}
    LIMIT ? OFFSET ?
  `;
    const dataValues = [...values, Number(pageSize), Number(offset)];
    const results = await executeQuery(dbConnection, dataQuery, dataValues);

    const filtersForMeta = pickNonEmpty({
        nombre: filtros.nombre,
        codigo: filtros.codigo,
        ...(filtros.habilitado !== "todos" && filtros.habilitado !== "" && filtros.habilitado !== undefined
            ? { habilitado: isFinite(Number(filtros.habilitado)) ? Number(filtros.habilitado) : filtros.habilitado }
            : {})
    });

    return {
        success: true,
        message: "Insumos obtenidos correctamente",
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

// Devuelve un objeto con solo claves cuyo valor no es null/undefined/"".
function pickNonEmpty(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) continue;
        if (typeof v === "string" && v.trim() === "") continue;
        out[k] = v;
    }
    return out;
}
