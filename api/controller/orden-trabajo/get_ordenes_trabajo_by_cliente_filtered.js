import { toBool01, pickNonEmpty, executeQuery } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, buildMeta } from "../../src/functions/query_utils.js";

export async function getFilteredOrdenesTrabajoByClienteFiltered({ db, req }) {
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

    // ---- filtros ----
    const filtros = {
        estado: Number.isFinite(Number(q.estado)) ? Number(q.estado) : undefined,
        asignado: toBool01(q.asignado, undefined),
        // ahora usamos la columna ot.alertada (0|1)
        alertada: toBool01(q.alertada, undefined),   // 0 | 1 | undefined
        pendiente: toBool01(q.pendiente, undefined), // si =1 -> queremos alertada=0
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
        .add("ot.superado = 0");

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

    // ---- NUEVO: filtrar por columna ot.alertada ----
    // Prioridad: si viene alertada (0/1) lo usamos tal cual.
    // --- parsing tri-state de alertada ---
    const alertadaTri = (() => {
        const v = q.alertada;
        if (v === undefined || v === null || v === "") return undefined; // no filtro
        if (v === true || v === "true" || v === 1 || v === "1") return 1;   // alertadas
        if (v === false || v === "false" || v === 0 || v === "0") return 0; // no alertadas
        return toBool01(v, undefined); // fallback
    })();

    // --- aplicar filtro ---
    if (alertadaTri === 1) {
        where.eq("ot.alertada", 1);
    } else if (alertadaTri === 0) {
        where.eq("ot.alertada", 0);
    }
    // si es undefined, no agregamos condición y vienen ambas

    // Si no viene ni alertada ni pendiente, no limitamos por esa columna.

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
    const [{ total }] = await executeQuery({ db, query: countSql, values: params });

    const parsedRows = rows.map(r => ({
        ...r,
        pedidos: typeof r.pedidos === "string" ? JSON.parse(r.pedidos) : r.pedidos
    }));

    const filtersForMeta = pickNonEmpty({
        ...(Number.isFinite(didClienteNum) ? { did_cliente: didClienteNum } : {}),
        ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
        ...(filtros.asignado !== undefined ? { asignado: filtros.asignado } : {}),
        ...(filtros.alertada !== undefined ? { alertada: filtros.alertada } : {}),
        ...(filtros.alertada === undefined && filtros.pendiente === 1 ? { pendiente: 1 } : {}),
    });

    return {
        success: true,
        message: "Órdenes de Trabajo obtenidas correctamente",
        data: parsedRows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
