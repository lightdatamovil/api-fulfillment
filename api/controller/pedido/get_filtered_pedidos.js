import { toStr, toBool01, pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta } from "../../src/functions/query_utils.js";

/**
 * GET /pedidos
 * Filtros soportados:
 *  - did_cliente (EQ)
 *  - estado (LIKE)
 *  - flex (EQ)
 *  - fecha_from / fecha_to (rango)
 *  - id_venta, comprador, ot (LIKE)
 *  - total_from / total_to (rango numérico)
 *  - armado / descargado (0/1)
 *  - paginación y orden
 */
export async function getFilteredPedidos(connection, req) {
    const q = req.query || {};
    console.log("Query params:", q);

    // Normalizo paginado/orden
    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    // === Filtros ===
    const filtros = {
        did_cliente: Number.isFinite(Number(q.did_cliente)) ? Number(q.did_cliente) : undefined,
        estado: toStr(q.estado)?.trim(),
        flex: Number.isFinite(Number(q.flex)) ? Number(q.flex) : undefined,

        fecha_from: toStr(q.fecha_from),
        fecha_to: toStr(q.fecha_to),

        id_venta: toStr(q.id_venta)?.trim(),
        comprador: toStr(q.comprador)?.trim(),
        ot: toStr(q.ot)?.trim(),

        total_from: q.total_from ? Number(q.total_from) : undefined,
        total_to: q.total_to ? Number(q.total_to) : undefined,

        armado: toBool01(q.armado, undefined),
        descargado: toBool01(q.descargado, undefined),
    };

    // Paginación
    const { page, pageSize, offset } = makePagination(qp, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    // Ordenamiento
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

    // WHERE
    const where = new SqlWhere().add("p.elim = 0");

    if (filtros.did_cliente !== undefined) where.eq("p.did_cliente", filtros.did_cliente);
    if (filtros.estado) where.likeEscaped("p.status", filtros.estado, { caseInsensitive: true });
    if (filtros.flex !== undefined) where.eq("p.flex", filtros.flex);

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
    console.log("WHERE SQL:", whereSql, "PARAMS:", params);

    // 🔹 Evitamos el error de MariaDB con LIMIT ? OFFSET ?
    const limitClause = `LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`;
    const safeOrderSql = `${orderSql} ${limitClause}`;
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
        offset, // 👈 volvemos a pasar los reales
    });

    const filtersForMeta = pickNonEmpty({
        ...(filtros.did_cliente !== undefined ? { did_cliente: filtros.did_cliente } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.flex !== undefined ? { flex: filtros.flex } : {}),
        ...(filtros.fecha_from ? { fecha_from: filtros.fecha_from } : {}),
        ...(filtros.fecha_to ? { fecha_to: filtros.fecha_to } : {}),
        ...(filtros.id_venta ? { id_venta: filtros.id_venta } : {}),
        ...(filtros.comprador ? { comprador: filtros.comprador } : {}),
        ...(filtros.total_from ? { total_from: filtros.total_from } : {}),
        ...(filtros.total_to ? { total_to: filtros.total_to } : {}),
        ...(filtros.armado !== undefined ? { armado: filtros.armado } : {}),
        ...(filtros.ot ? { ot: filtros.ot } : {}),
    });

    return {
        success: true,
        message: "Pedidos obtenidos correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
