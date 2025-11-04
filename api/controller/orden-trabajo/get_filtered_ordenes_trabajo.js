import { toStr, toBool01, pickNonEmpty, executeQuery } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta } from "../../src/functions/query_utils.js";

/**
 * Listado filtrado/paginado de OT.
 * Query soportados:
 *  - estado (EQ), asignada (0/1)
 *  - fecha_inicio_from / fecha_inicio_to
 *  - fecha_fin_from / fecha_fin_to
 *  - sort_by: did|estado|asignada|fecha_inicio|fecha_fin
 */
export async function getFilteredOrdenesTrabajo(connection, req) {
    const q = req.query || {};

    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    const filtros = {
        estado: Number.isFinite(Number(q.estado)) ? Number(q.estado) : undefined,
        asignada: toBool01(q.asignada, undefined),
        fecha_inicio_from: toStr(q.fecha_inicio_from),
        fecha_inicio_to: toStr(q.fecha_inicio_to),
        fecha_fin_from: toStr(q.fecha_fin_from),
        fecha_fin_to: toStr(q.fecha_fin_to),
    };

    const { page, pageSize, offset } = makePagination(qp, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    const sortMap = {
        did: "ot.did",
        estado: "ot.estado",
        asignada: "ot.asignada",
        fecha_inicio: "ot.fecha_inicio",
        fecha_fin: "ot.fecha_fin",
    };
    const { orderSql } = makeSort(qp, sortMap, { defaultKey: "did", byKey: "sort_by", dirKey: "sort_dir" });

    const where = new SqlWhere().add("ot.elim = 0").add("ot.superado=0");
    if (filtros.estado !== undefined) where.eq("ot.estado", filtros.estado);
    if (filtros.asignada !== undefined) where.eq("ot.asignada", filtros.asignada);
    if (filtros.fecha_inicio_from) where.add("ot.fecha_inicio >= ?", [filtros.fecha_inicio_from]);
    if (filtros.fecha_inicio_to) where.add("ot.fecha_inicio <= ?", [filtros.fecha_inicio_to]);
    if (filtros.fecha_fin_from) where.add("ot.fecha_fin >= ?", [filtros.fecha_fin_from]);
    if (filtros.fecha_fin_to) where.add("ot.fecha_fin <= ?", [filtros.fecha_fin_to]);

    const { whereSql, params } = where.finalize();



    const dataSql = `
        SELECT 
    p.did_cliente,
    COUNT(DISTINCT ot.did) AS ordenes_total,
    COUNT(DISTINCT CASE WHEN pp.did_producto IS NULL THEN ot.did END) AS ordenes_alertadas,
    COUNT(DISTINCT CASE WHEN pp.did_producto IS NOT NULL THEN ot.did END) AS ordenes_pendientes
FROM ordenes_trabajo AS ot
LEFT JOIN ordenes_trabajo_pedidos AS otp 
    ON ot.did = otp.did_orden_trabajo
LEFT JOIN pedidos AS p
    ON otp.did_pedido = p.id
LEFT JOIN pedidos_productos AS pp 
    ON otp.did_pedido = pp.did_pedido
${whereSql /* Ej: WHERE ot.elim = 0 AND ot.superado = 0 */}
GROUP BY p.did_cliente
${orderSql /* Ej: ORDER BY p.did_cliente ASC */}
LIMIT ? OFFSET ?;

        `;

    const rows = await executeQuery(connection, dataSql, [...params, pageSize, offset], true);
    /*
        const { rows, total } = await runPagedQuery(connection, {
            select: `ot.did, ot.estado, ot.asignada, ot.fecha_inicio, ot.fecha_fin, ot.autofecha`,
            from: "FROM ordenes_trabajo ot",
            whereSql,
            orderSql,
            params,
            pageSize,
            offset,
        });
        */

    const total = rows.length;

    const filtersForMeta = pickNonEmpty({
        ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
        ...(filtros.asignada !== undefined ? { asignada: filtros.asignada } : {}),
        ...(filtros.fecha_inicio_from ? { fecha_inicio_from: filtros.fecha_inicio_from } : {}),
        ...(filtros.fecha_inicio_to ? { fecha_inicio_to: filtros.fecha_inicio_to } : {}),
        ...(filtros.fecha_fin_from ? { fecha_fin_from: filtros.fecha_fin_from } : {}),
        ...(filtros.fecha_fin_to ? { fecha_fin_to: filtros.fecha_fin_to } : {}),
    });

    return {
        success: true,
        message: "Órdenes de Trabajo obtenidas correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
