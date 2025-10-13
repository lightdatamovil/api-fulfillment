// clientes.controller.js
import { executeQuery, toStr, toBool, pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, buildMeta } from "../../src/functions/query_utils.js";

/**
 * GET /clientes
 * Query params:
 *   nombre_fantasia, codigo, razon_social, habilitado,
 *   pagina|page, cantidad|page_size, sort_by, sort_dir
 */
export async function getFilteredClientes(connection, req) {
  const q = req.query;

  const qp = { ...q, page: q.page ?? q.pagina, page_size: q.page_size ?? q.cantidad };

  const filtros = {
    nombre_fantasia: toStr(q.nombre_fantasia),
    codigo: toStr(q.codigo),
    razon_social: toStr(q.razon_social),
    habilitado: toBool(q.estado ?? q.habilitado, undefined),
  };

  const { page, pageSize, offset } = makePagination(qp, {
    pageKey: "page",
    pageSizeKey: "page_size",
    defaultPage: 1,
    defaultPageSize: 10,
    maxPageSize: 100,
  });

  const sortMap = {
    codigo: "c.codigo",
    nombre_fantasia: "c.nombre_fantasia",
    razon_social: "c.razon_social",
    estado: "c.habilitado",
  };
  const { orderSql } = makeSort(q, sortMap, {
    defaultKey: "nombre_fantasia",
    byKey: "sort_by",
    dirKey: "sort_dir",
  });

  const where = new SqlWhere().add("c.superado = 0").add("c.elim = 0");
  if (filtros.codigo) where.likeEscaped("c.codigo", filtros.codigo, { caseInsensitive: true });
  if (filtros.nombre_fantasia) where.likeEscaped("c.nombre_fantasia", filtros.nombre_fantasia, { caseInsensitive: true });
  if (filtros.razon_social) where.likeEscaped("c.razon_social", filtros.razon_social, { caseInsensitive: true });
  if (filtros.habilitado !== undefined) where.eq("c.habilitado", filtros.habilitado);

  const { whereSql, params } = where.finalize();

  const countSql = `SELECT COUNT(*) AS total FROM clientes c ${whereSql}`;
  const [{ total = 0 } = {}] = await executeQuery(connection, countSql, params);

  const dataSql = `
    SELECT
      c.did,
      c.nombre_fantasia,
      c.habilitado,
      c.codigo,
      c.observaciones,
      c.razon_social,
      c.quien
    FROM clientes c
    ${whereSql}
    ${orderSql}
    LIMIT ? OFFSET ?;
  `;

  const rows = await executeQuery(connection, dataSql, [...params, pageSize, offset]);

  const clientesFinal = rows.map(r => ({
    did: r.did,
    nombre_fantasia: r.nombre_fantasia,
    habilitado: r.habilitado,
    codigo: r.codigo,
    observaciones: r.observaciones,
    razon_social: r.razon_social,
    quien: r.quien,

  }));

  return {
    success: true,
    message: "Clientes obtenidos correctamente",
    data: clientesFinal,
    meta: buildMeta({
      page,
      pageSize,
      totalItems: total,
      filters: pickNonEmpty({
        nombre_fantasia: filtros.nombre_fantasia,
        codigo: filtros.codigo,
        razon_social: filtros.razon_social,
        ...(filtros.habilitado !== undefined ? { habilitado: filtros.habilitado } : {}),
      }),
    }),
  };
}
