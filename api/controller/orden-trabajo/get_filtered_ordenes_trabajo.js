import { toStr, toBool01, pickNonEmpty, toIntList, executeQuery } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, buildMeta, runPagedQuery } from "../../src/functions/query_utils.js";

export async function getFilteredOrdenesTrabajo({ db, req }) {
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
        did_cliente: toIntList(q.did_cliente, undefined),
        fecha_inicio_from: toStr(q.fecha_inicio_from),
        fecha_inicio_to: toStr(q.fecha_inicio_to),
        fecha_fin_from: toStr(q.fecha_fin_from),
        fecha_fin_to: toStr(q.fecha_fin_to),
        alertada: toBool01(q.alertada, undefined),
        pendiente: toBool01(q.pendiente, undefined),

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
        asignado: "ot.asignado",
        fecha_inicio: "ot.fecha_inicio",
        fecha_fin: "ot.fecha_fin",
    };

    const { orderSql } = makeSort(qp, sortMap, { defaultKey: "ot.fecha_inicio", byKey: "sort_by", dirKey: "sort_dir" });

    const where = new SqlWhere().add("ot.elim = 0").add("ot.superado=0");
    if (filtros.estado !== undefined) where.eq("ot.estado", filtros.estado);
    if (filtros.asignada !== undefined) where.eq("ot.asignada", filtros.asignada);
    if (filtros.did_cliente !== undefined) where.in("p.did_cliente", filtros.did_cliente);
    if (filtros.fecha_inicio_from) where.add("ot.fecha_inicio >= ?", [filtros.fecha_inicio_from]);
    if (filtros.fecha_inicio_to) where.add("ot.fecha_inicio <= ?", [filtros.fecha_inicio_to]);
    if (filtros.fecha_fin_from) where.add("ot.fecha_fin >= ?", [filtros.fecha_fin_from]);
    if (filtros.fecha_fin_to) where.add("ot.fecha_fin <= ?", [filtros.fecha_fin_to]);
    if (filtros.alertada) where.add("pp.did_producto IS NULL", filtros.alertada);
    if (filtros.pendiente) where.add("pp.did_producto IS NOT NULL", filtros.pendiente);

    // validación: son excluyentes
    if (filtros.alertada === 1 && filtros.pendiente === 1) {
        throw new Error("No se puede filtrar 'alertada' y 'pendiente' simultáneamente.");
    }

    // ALERTADA: existe al menos un producto sin did_producto en la OT
    if (filtros.alertada === 1) {
        where.add(`
    EXISTS (
      SELECT 1
      FROM ordenes_trabajo_pedidos otp2
      JOIN pedidos_productos pp2 ON pp2.did_pedido = otp2.did_pedido
      WHERE otp2.did_orden_trabajo = ot.did
        AND pp2.did_producto IS NULL
    )
  `);
    }

    // PENDIENTE: no existe ningún producto sin did_producto en la OT
    if (filtros.pendiente === 1) {
        where.add(`
    NOT EXISTS (
      SELECT 1
      FROM ordenes_trabajo_pedidos otp3
      JOIN pedidos_productos pp3 ON pp3.did_pedido = otp3.did_pedido
      WHERE otp3.did_orden_trabajo = ot.did
        AND pp3.did_producto IS NULL
    )
  `);
    }

    const { whereSql, params } = where.finalize();
    /*
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
    
    
    //    const rows = await executeQuery({ db, query: whereSql, values: [...params, pageSize, offset] });
    //     const total = rows.length;
    
    
    const from = `
    FROM ordenes_trabajo AS ot
    LEFT JOIN ordenes_trabajo_pedidos AS otp ON ot.did = otp.did_orden_trabajo
    LEFT JOIN pedidos AS p ON otp.did_pedido = p.id
    LEFT JOIN pedidos_productos AS pp ON otp.did_pedido = pp.did_pedido
    `;
    
    // 5) ***IMPORTANTE***: como hay GROUP BY, usa la variante "groups"
    const result = await runPagedQueryGroups(db, {
        select,
        from,
        whereSql,
        groupBy: "p.did_cliente",
        orderSql,
        params,
        pageSize,
        offset
    });
    */

    const filtersForMeta = pickNonEmpty({
        ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
        ...(filtros.asignado !== undefined ? { asignado: filtros.asignado } : {}),
        ...(filtros.fecha_inicio_from ? { fecha_inicio_from: filtros.fecha_inicio_from } : {}),
        ...(filtros.fecha_inicio_to ? { fecha_inicio_to: filtros.fecha_inicio_to } : {}),
        ...(filtros.fecha_fin_from ? { fecha_fin_from: filtros.fecha_fin_from } : {}),
        ...(filtros.fecha_fin_to ? { fecha_fin_to: filtros.fecha_fin_to } : {}),
    });

    return {
        data: result.rows,            // [{ did_cliente, ordenes_total, ...}]
        meta: {
            page,
            pageSize,
            totalPages: Math.ceil(result.total / pageSize),
            totalItems: result.total,
            filtersForMeta
        }
    };
}




export async function runPagedQueryGroups(
    db,
    { select, from, whereSql = "", groupBy, orderSql = "", params = [], pageSize, offset }
) {
    if (!groupBy) throw new Error("groupBy requerido para consultas agregadas");

    // Datos paginados
    const dataSql = `
SELECT ${select}
${from}
${whereSql}
GROUP BY ${groupBy}
${orderSql}
LIMIT ? OFFSET ?
`;
    const rows = await executeQuery({
        db,
        query: dataSql,
        values: [...params, pageSize, offset],
    });

    // Total de grupos (clientes)
    // Opción A: contar DISTINCT de la(s) clave(s) de agrupación
    const countSql = `
SELECT COUNT(DISTINCT ${groupBy}) AS total
${from}
${whereSql}
`;
    const [{ total = 0 } = {}] = await executeQuery({
        db,
        query: countSql,
        values: params,
    });

    // Opción B (alternativa general): envolver la query agrupada y contar
    // const countSql = `
    //   SELECT COUNT(*) AS total FROM (
    //     SELECT 1
    //     ${from}
    //     ${whereSql}
    //     GROUP BY ${groupBy}
    //   ) t
    // `;

    return { rows, total };
}
