// controller/pedidos/get_filtered_pedidos.js
import { toStr, toBool01, pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta } from "../../src/functions/query_utils.js";

/**
 * Listado con filtros y paginado.
 * Query soportados:
 *  - status (LIKE), number (LIKE), buyer_nickname (LIKE)
 *  - did_cuenta (EQ), armado (0/1), descargado (0/1)
 *  - fecha_venta_from / fecha_venta_to (rango)
 */
export async function getFilteredPedidos(connection, req) {
    const q = req.query || {};

    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    const filtros = {
        status: toStr(q.status),
        number: toStr(q.number),
        buyer_nickname: toStr(q.buyer_nickname),
        did_cuenta: Number.isFinite(Number(q.did_cuenta)) ? Number(q.did_cuenta) : undefined,
        armado: toBool01(q.armado, undefined),
        descargado: toBool01(q.descargado, undefined),
        fecha_venta_from: toStr(q.fecha_venta_from),
        fecha_venta_to: toStr(q.fecha_venta_to),
    };

    const { page, pageSize, offset } = makePagination(qp, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    const sortMap = {
        // IDs base
        did: "p.did",

        // === ALIAS → COLUMNA BD (según tu mapeo) ===
        did_cliente: "p.did_cliente",     // did_cliente en la BD
        fecha: "p.fecha_venta",           // fecha-venta en la BD
        did_cuenta: "p.did_cuenta",       // did_cuenta en la BD
        id_venta: "p.number",             // number en la BD
        comprador: "p.buyer_name",        // buyer_name en la BD
        estado: "p.status",               // status en la BD
        total: "p.total_amount",          // total_amount en la BD
        armado: "p.armado",               // armado en la BD
        ot: "p.ot",                       // ot en la BD
    };

    const { orderSql } = makeSort(qp, sortMap, {
        defaultKey: "fecha",     // default: fecha (alias tuyo)
        byKey: "sort_by",
        dirKey: "sort_dir",
    });

    const where = new SqlWhere().add("p.elim = 0");

    if (filtros.status) where.likeEscaped("p.status", filtros.status, { caseInsensitive: true });
    if (filtros.number) where.likeEscaped("p.number", filtros.number, { caseInsensitive: true });
    if (filtros.buyer_nickname) where.likeEscaped("p.buyer_nickname", filtros.buyer_nickname, { caseInsensitive: true });
    if (filtros.did_cuenta !== undefined) where.eq("p.did_cuenta", filtros.did_cuenta);
    if (filtros.armado !== undefined) where.eq("p.armado", filtros.armado);
    if (filtros.descargado !== undefined) where.eq("p.descargado", filtros.descargado);
    if (filtros.fecha_venta_from) where.add("p.fecha_venta >= ?", [filtros.fecha_venta_from]);
    if (filtros.fecha_venta_to) where.add("p.fecha_venta <= ?", [filtros.fecha_venta_to]);

    const { whereSql, params } = where.finalize();
    const { rows, total } = await runPagedQuery(connection, {
        select: `
    p.did,
    p.did_cliente,                     -- por si lo querés mostrar también
    p.did_cuenta,
    p.fecha_venta      AS fecha,
    p.status           AS estado,
    p.number           AS id_venta,
    p.buyer_name       AS comprador,
    p.total_amount     AS total,
    p.armado           AS armado,
    p.descargado       AS descargado
 --   p.ot               AS ot
  `,
        from: "FROM pedidos p",
        whereSql,
        orderSql,
        params,
        pageSize,
        offset,
    });

    const filtersForMeta = pickNonEmpty({
        status: filtros.status,
        number: filtros.number,
        buyer_nickname: filtros.buyer_nickname,
        ...(filtros.did_cuenta !== undefined ? { did_cuenta: filtros.did_cuenta } : {}),
        ...(filtros.armado !== undefined ? { armado: filtros.armado } : {}),
        ...(filtros.descargado !== undefined ? { descargado: filtros.descargado } : {}),
        ...(filtros.fecha_venta_from ? { fecha_venta_from: filtros.fecha_venta_from } : {}),
        ...(filtros.fecha_venta_to ? { fecha_venta_to: filtros.fecha_venta_to } : {}),
    });

    return {
        success: true,
        message: "Pedidos obtenidos correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}

// did_cliente es did_cliente en la BD
// fecha es fecha-venta en la BD
//did_cuenta es did_cuenta en la BD
// id_venta es number en la BD
// comprador es buyer_name en la BD
//estado es status en la BD
//total es total_amount  en la BD
//ot es ot en la bd
// armado es armado en la BD
