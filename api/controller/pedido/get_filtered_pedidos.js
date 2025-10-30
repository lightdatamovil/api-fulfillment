import { toStr, toBool01, pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta } from "../../src/functions/query_utils.js";

export async function getFilteredPedidos(connection, req) {
    const q = req.query || {};

    // Normalizo paginado/orden
    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    // =========================
    // ALIAS -> columnas reales (p.*)
    // did_cliente -> p.did_cliente
    // estado      -> p.status
    // flex        -> p.flex
    // =========================

    // 🔹 Parse múltiple: convierte "1,2,3" → [1,2,3], "a,b" → ["a","b"]
    const parseList = (input, numeric = false) => {
        if (!input) return [];
        const list = Array.isArray(input) ? input : String(input).split(",");
        return list
            .map(v => v.trim())
            .filter(v => v !== "")
            .map(v => (numeric ? Number(v) : v))
            .filter(v => (numeric ? Number.isFinite(v) : v.length > 0));
    };

    // === Filtros principales ===
    const filtros = {
        did_clientes: parseList(q.did_cliente, true),
        estados: parseList(q.estado, false),
        flexValues: parseList(q.flex, true),

        fecha_from: toStr(q.fecha_from),
        fecha_to: toStr(q.fecha_to),

        id_venta: toStr(q.id_venta),
        comprador: toStr(q.comprador),
        ot: toStr(q.ot),

        total_from: q.total_from != null && q.total_from !== "" ? Number(q.total_from) : undefined,
        total_to: q.total_to != null && q.total_to !== "" ? Number(q.total_to) : undefined,

        armado: toBool01(q.armado, undefined),
        descargado: toBool01(q.descargado, undefined),
    };

    const { page, pageSize, offset } = makePagination(qp, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    // Ordenamientos por ALIAS
    const sortMap = {
        did: "p.did",
        did_cliente: "p.did_cliente",
        fecha: "p.fecha_venta",
        id_venta: "p.number",
        comprador: "p.buyer_name",
        estado: "p.status",
        total: "p.total_amount",
        armado: "p.armado",
        ot: "p.ot",
        flex: "p.flex",
    };
    const { orderSql } = makeSort(qp, sortMap, {
        defaultKey: "fecha",
        byKey: "sort_by",
        dirKey: "sort_dir",
    });

    // WHERE usando SIEMPRE las columnas reales
    const where = new SqlWhere().add("p.elim = 0");

    // ✅ Múltiples clientes
    if (filtros.did_clientes.length > 0) {
        const placeholders = filtros.did_clientes.map(() => "?").join(",");
        where.add(`p.did_cliente IN (${placeholders})`, filtros.did_clientes);
    }

    // ✅ Múltiples estados
    if (filtros.estados.length > 0) {
        const placeholders = filtros.estados.map(() => "?").join(",");
        where.add(`p.status IN (${placeholders})`, filtros.estados);
    }

    // ✅ Múltiples valores de flex
    if (filtros.flexValues.length > 0) {
        const placeholders = filtros.flexValues.map(() => "?").join(",");
        where.add(`p.flex IN (${placeholders})`, filtros.flexValues);
    }


    if (filtros.fecha_from) where.add("p.fecha_venta >= ?", [filtros.fecha_from]);
    if (filtros.fecha_to) where.add("p.fecha_venta <= ?", [filtros.fecha_to]);

    if (filtros.id_venta) where.likeEscaped("p.number", filtros.id_venta, { caseInsensitive: true });
    if (filtros.comprador) where.likeEscaped("p.buyer_name", filtros.comprador, { caseInsensitive: true });
    if (filtros.ot) where.likeEscaped("p.ot", filtros.ot, { caseInsensitive: true });

    if (Number.isFinite(filtros.total_from)) where.add("p.total_amount >= ?", [filtros.total_from]);
    if (Number.isFinite(filtros.total_to)) where.add("p.total_amount <= ?", [filtros.total_to]);

    if (filtros.armado !== undefined) where.eq("p.armado", filtros.armado);
    if (filtros.descargado !== undefined) where.eq("p.descargado", filtros.descargado);

    const { whereSql, params } = where.finalize();

    const { rows, total } = await runPagedQuery(connection, {
        select: `
            p.did,
            p.did_cliente,
            p.fecha_venta      AS fecha,
            p.status           AS estado,
            p.number           AS id_venta,
            p.buyer_name       AS comprador,
            p.total_amount     AS total,
            p.armado           AS armado,
            p.descargado       AS descargado,
            p.flex
        `,
        from: "FROM pedidos p",
        whereSql,
        orderSql,
        params,
        pageSize,
        offset,
    });

    const filtersForMeta = pickNonEmpty({
        did_clientes: filtros.did_clientes,
        estados: filtros.estados,
        flexValues: filtros.flexValues,
        fecha_from: filtros.fecha_from,
        fecha_to: filtros.fecha_to,
        id_venta: filtros.id_venta,
        comprador: filtros.comprador,
        total_from: Number.isFinite(filtros.total_from) ? filtros.total_from : undefined,
        total_to: Number.isFinite(filtros.total_to) ? filtros.total_to : undefined,
        armado: filtros.armado,
        ot: filtros.ot,
    });

    return {
        success: true,
        message: "Pedidos obtenidos correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
