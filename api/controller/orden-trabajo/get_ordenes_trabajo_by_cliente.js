import { toStr, toBool01, pickNonEmpty, executeQuery } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, buildMeta } from "../../src/functions/query_utils.js";

export async function getFilteredOrdenesTrabajoByCliente({ db, req }) {
    console.log("params", req.params);
    console.log("req.query", req.query);
    const { did_cliente: didClienteParamRaw } = req.params;
    const q = req.query || {};

    // normalizamos did_cliente param
    const didClienteParam =
        didClienteParamRaw === undefined || didClienteParamRaw === null
            ? undefined
            : String(didClienteParamRaw).trim().toLowerCase();

    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    const filtros = {
        estado: Number.isFinite(Number(q.estado)) ? Number(q.estado) : undefined,
        asignado: toBool01(q.asignado, undefined),
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
        fecha_inicio: "ot.fecha_inicio",
        fecha_fin: "ot.fecha_fin",
    };
    const { orderSql } = makeSort(qp, sortMap, { defaultKey: "did", byKey: "sort_by", dirKey: "sort_dir" });

    const where = new SqlWhere().add("ot.elim = 0").add("ot.superado = 0");

    // 🔒 siempre excluimos pedidos con did_cliente NULL
    where.add("p.did_cliente IS NOT NULL");

    // si viene un did_cliente válido, filtramos por ese cliente
    const didClienteNum = Number(didClienteParam);
    if (
        didClienteParam !== undefined &&
        didClienteParam !== "" &&
        didClienteParam !== "null" &&
        Number.isFinite(didClienteNum)
    ) {
        where.eq("p.did_cliente", didClienteNum);
    }

    if (filtros.estado !== undefined) where.eq("ot.estado", filtros.estado);
    if (filtros.asignado !== undefined) where.eq("ot.asignado", filtros.asignado);

    // ALERTADAS: al menos un pedido SIN productos
    if (filtros.alertada === "1") {
        where.add(`
      EXISTS (
        SELECT 1
        FROM ordenes_trabajo_pedidos otp1
        LEFT JOIN pedidos p1 ON p1.id = otp1.did_pedido
        LEFT JOIN pedidos_productos pp1 ON pp1.did_pedido = p1.id
        WHERE otp1.did_orden_trabajo = ot.did
          AND p1.did_cliente IS NOT NULL
          AND pp1.did IS NULL
      )
    `);
    }

    // PENDIENTES: al menos un pedido CON productos
    if (filtros.pendiente === "1") {
        where.add(`
      EXISTS (
        SELECT 1
        FROM ordenes_trabajo_pedidos otp2
        JOIN pedidos p2 ON p2.id = otp2.did_pedido
        JOIN pedidos_productos pp2 ON pp2.did_pedido = p2.id
        WHERE otp2.did_orden_trabajo = ot.did
          AND p2.did_cliente IS NOT NULL
      )
    `);
    }

    const { whereSql, params } = where.finalize();

    const dataSql = `
    SELECT 
      ot.did,
      ot.estado,
      ot.asignado,
      ot.fecha_inicio,
      ot.fecha_fin,
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
    const [{ total }] = await executeQuery({ db, query: countSql, values: params });

    const parsedRows = rows.map(r => ({
        ...r,
        pedidos: typeof r.pedidos === "string" ? JSON.parse(r.pedidos) : r.pedidos
    }));

    const filtersForMeta = pickNonEmpty({
        ...(Number.isFinite(didClienteNum) ? { did_cliente: didClienteNum } : {}),
        ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
        ...(filtros.asignado !== undefined ? { asignado: filtros.asignado } : {}),
        ...(filtros.alertada === "1" ? { alertada: 1 } : {}),
        ...(filtros.pendiente === "1" ? { pendiente: 1 } : {}),
    });

    return {
        success: true,
        message: "Órdenes de Trabajo obtenidas correctamente",
        data: parsedRows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
