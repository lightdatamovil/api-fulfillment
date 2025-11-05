import { toStr, toBool01, pickNonEmpty, executeQuery } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, buildMeta } from "../../src/functions/query_utils.js";

export async function getFilteredOrdenesTrabajoByCliente({ db, req }) {
    console.log("params", req.params);
    console.log("req.query", req.query);
    const { did_cliente } = req.params;
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
        alertada: toStr(q.alertada),
        pendiente: toStr(q.pendiente),
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
    if (filtros.alertada == "1") where.add("pp.did_producto IS null");
    if (filtros.pendiente == "1") where.add("pp.did_producto IS NOT null");
    if (did_cliente) where.eq("p.did_cliente", Number(did_cliente));

    const { whereSql, params } = where.finalize();

    const dataSql = `
        SELECT 
            ot.did,
            ot.estado,
            ot.asignado,
            ot.fecha_inicio,
            ot.fecha_fin,
            otp.did_pedido,
            COALESCE(
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'did', p.did,
                        'flex', p.flex,
                        'estado', p.status,
                        'id_venta', p.number,
                        'productos', (
                            SELECT COALESCE(
                                JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'did', pp2.did,
                                        'did_producto', pp2.did_producto,
                                        'descripcion', pp2.descripcion,
                                        'codigo', pp2.codigo,
                                        'ml_id', pp2.ml_id,
                                        'cantidad', pp2.cantidad,
                                        'seller_sku', pp2.seller_sku
                                    )
                                ),
                                JSON_ARRAY()
                            )
                            FROM pedidos_productos AS pp2
                            WHERE pp2.did_pedido = p.id
                        )
                    )
                ),
                JSON_ARRAY()
            ) AS pedidos
        FROM ordenes_trabajo AS ot
        LEFT JOIN ordenes_trabajo_pedidos AS otp 
            ON ot.did = otp.did_orden_trabajo
        LEFT JOIN pedidos AS p
            ON otp.did_pedido = p.id
        ${whereSql /* Ejemplo: WHERE ot.elim = 0 AND ot.superado = 0 */}
        GROUP BY ot.did, otp.did_pedido, p.did_cliente
        ${orderSql}
        LIMIT ? OFFSET ?;

        `;

    const rows = await executeQuery({ db, query: dataSql, values: [...params, pageSize, offset] });
    /*
        const { rows, total } = await runPagedQuery(connection, {
            select: `ot.did, ot.estado, ot.asignada, ot.fecha_inicio, ot.fecha_fin, otp.did_pedido`,
            from: "FROM ordenes_trabajo ot",
            whereSql,
            orderSql,
            params,
            pageSize,
            offset,
        });
     */

    const parsedRows = rows.map(r => ({
        ...r,
        pedidos: typeof r.pedidos === "string" ? JSON.parse(r.pedidos) : r.pedidos
    }));

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
        data: parsedRows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
