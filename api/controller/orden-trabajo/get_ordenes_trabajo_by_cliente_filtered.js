import { toBool01, pickNonEmpty, executeQuery } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, buildMeta } from "../../src/functions/query_utils.js";

export async function getFilteredOrdenesTrabajoByClienteFiltered({ db, req }) {
    const q = req.query || {};

    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    // ---- filtros ----
    const filtros = {
        // ahora did_cliente viene de query
        did_cliente: q.did_cliente ? Number(q.did_cliente) : undefined,

        // estado de la OT
        estado: q.estado ? Number(q.estado) : undefined,

        asignado: toBool01(q.asignado, undefined),

        // alertada tri-state (0 | 1 | undefined)
        alertada: (() => {
            const v = q.alertada;
            if (v === undefined || v === null || v === "") return undefined;
            if (v === true || v === "true" || v === 1 || v === "1") return 1;
            if (v === false || v === "false" || v === 0 || v === "0") return 0;
            return toBool01(v, undefined);
        })(),

        // fechas sobre ot.fecha_inicio
        fecha_from:
            typeof q.fecha_from === "string" && q.fecha_from.trim()
                ? `${q.fecha_from.trim()} 00:00:00`
                : undefined,
        fecha_to:
            typeof q.fecha_to === "string" && q.fecha_to.trim()
                ? `${q.fecha_to.trim()} 23:59:59`
                : undefined,

        // id_venta → p.number (LIKE CI)
        id_venta: typeof q.id_venta === "string" ? q.id_venta.trim() : undefined,

        // origen → p.flex
        origen: Number.isFinite(Number(q.origen)) ? Number(q.origen) : undefined,
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
        fecha_inicio: "ot.fecha_inicio",
        fecha_fin: "ot.fecha_fin",
    };
    const { orderSql } = makeSort(qp, sortMap, { defaultKey: "did", byKey: "sort_by", dirKey: "sort_dir" });

    const where = new SqlWhere()
        .add("ot.elim = 0")
        .add("ot.superado = 0")
        // 🔒 evitamos pedidos huérfanos
        .add("p.did_cliente IS NOT NULL");

    // did_cliente por query
    if (filtros.did_cliente !== undefined) where.eq("p.did_cliente", filtros.did_cliente);

    // estado de OT
    if (filtros.estado !== undefined) {
        where.eq("ot.estado", filtros.estado);
    }

    if (filtros.asignado !== undefined) where.eq("ot.asignado", filtros.asignado);

    // alertada tri-state
    if (filtros.alertada === 1) where.eq("ot.alertada", 1);
    else if (filtros.alertada === 0) where.eq("ot.alertada", 0);
    // undefined => no filtra (vienen ambas)

    // fechas
    if (filtros.fecha_from) where.add("ot.fecha_inicio >= ?", filtros.fecha_from);
    if (filtros.fecha_to) where.add("ot.fecha_inicio <= ?", filtros.fecha_to);

    // id_venta (p.number) LIKE CI
    if (filtros.id_venta) where.likeCI("p.number", filtros.id_venta);

    // origen (p.flex)
    if (filtros.origen !== undefined) where.eq("p.flex", filtros.origen);

    const { whereSql, params } = where.finalize();

    const dataSql = `
    SELECT 
      ot.did,
      ot.estado,
      ot.asignado,
      ot.fecha_inicio,
      ot.fecha_fin,
      ot.alertada,
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
    ${whereSql}
    GROUP BY ot.did
    ${orderSql}
    LIMIT ? OFFSET ?;
  `;

    const countSql = `
    SELECT COUNT(DISTINCT ot.did) AS total
    FROM ordenes_trabajo AS ot
    LEFT JOIN ordenes_trabajo_pedidos AS otp 
      ON ot.did = otp.did_orden_trabajo
    LEFT JOIN pedidos AS p
      ON otp.did_pedido = p.id
    ${whereSql};
  `;

    const rows = await executeQuery({ db, query: dataSql, values: [...params, pageSize, offset] });
    const [{ total = 0 } = {}] = await executeQuery({ db, query: countSql, values: params });

    const parsedRows = rows.map(r => ({
        ...r,
        pedidos: typeof r.pedidos === "string" ? JSON.parse(r.pedidos) : r.pedidos
    }));

    const filtersForMeta = pickNonEmpty({
        ...(filtros.did_cliente !== undefined ? { did_cliente: filtros.did_cliente } : {}),
        ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
        ...(filtros.asignado !== undefined ? { asignado: filtros.asignado } : {}),
        ...(filtros.alertada !== undefined ? { alertada: filtros.alertada } : {}),
        ...(q.fecha_from ? { fecha_from: q.fecha_from } : {}),
        ...(q.fecha_to ? { fecha_to: q.fecha_to } : {}),
        ...(filtros.id_venta ? { id_venta: filtros.id_venta } : {}),
        ...(filtros.origen !== undefined ? { origen: filtros.origen } : {}),
    });

    return {
        success: true,
        message: "Órdenes de Trabajo obtenidas correctamente",
        data: parsedRows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
