import { executeQuery, toStr, toBool, pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, buildMeta } from "../../src/functions/query_utils.js";

export async function getFilteredLogisticas({ db, req }) {
  const q = req.query;

  const qp = { ...q, page: q.page ?? q.pagina, page_size: q.page_size ?? q.cantidad };

  const filtros = {
    nombre: toStr(q.nombre),
    codigo: toStr(q.codigo),
    codigoSync: toStr(q.codigoSync),
    sync: toBool(q.sync ?? q.sync, undefined),
    habilitado: toBool(q.habilitado ?? q.habilitado, undefined),
  };

  const { page, pageSize, offset } = makePagination(qp, {
    pageKey: "page",
    pageSizeKey: "page_size",
    defaultPage: 1,
    defaultPageSize: 10,
    maxPageSize: 100,
  });

  const sortMap = {
    codigo: "l.codigo",
    nombre: "l.nombre",
    codigoSync: "l.codigoSync",
    sync: "l.sync",
  };
  const { orderSql } = makeSort(q, sortMap, {
    defaultKey: "nombre",
    byKey: "sort_by",
    dirKey: "sort_dir",
  });

  const where = new SqlWhere().add("l.superado = 0").add("l.elim = 0");
  if (filtros.codigo) where.likeEscaped("l.codigo", filtros.codigo, { caseInsensitive: true });
  if (filtros.nombre) where.likeEscaped("l.nombre", filtros.nombre, { caseInsensitive: true });
  if (filtros.codigoSync) where.likeEscaped("l.codigoSync", filtros.codigoSync, { caseInsensitive: true });
  if (filtros.habilitado !== undefined && filtros.habilitado !== "todos") where.eq("l.habilitado", toBool(filtros.habilitado));
  if (filtros.sync !== undefined && filtros.sync !== "todos") where.eq("l.sync", toBool(filtros.sync));

  const { whereSql, params } = where.finalize();

  const countSql = `SELECT COUNT(*) AS total FROM logisticas l ${whereSql}`;
  const [{ total = 0 } = {}] = await executeQuery({ db, query: countSql, values: params });

  const dataSql = `
    SELECT
      l.did,
      l.nombre,
      l.sync,
      l.codigo,
      l.codigoSync,
      l.quien,
      l.habilitado,
      CASE
        WHEN COUNT(d.did) = 0 THEN JSON_ARRAY()
        ELSE JSON_ARRAYAGG(
          JSON_OBJECT(
            'did', d.did,
            'titulo', d.titulo,
            'cp', d.cp,
            'calle', d.calle,
            'pais', d.pais,
            'localidad', d.localidad,
            'numero', d.numero,
            'provincia', d.provincia,
            'address_line', d.address_line
          )
        )
      END AS direcciones
    FROM logisticas AS l
    LEFT JOIN logisticas_direcciones AS d
      ON d.did_logistica = l.did
      AND d.elim = 0
      AND d.superado = 0
    ${whereSql}
    /* Si whereSql pudiera venir vacío, garantizá base: WHERE l.elim = 0 AND l.superado = 0 */
    GROUP BY
      l.did, l.nombre, l.sync, l.codigo, l.codigoSync, l.quien, l.habilitado
    ${orderSql}
    LIMIT ? OFFSET ?;
      `;

  const rows = await executeQuery({ db, query: dataSql, values: [...params, pageSize, offset] });

  const logisticasFinal = rows.map(l => ({
    did: l.did,
    nombre: l.nombre,
    sync: l.sync,
    codigo: l.codigo,
    codigoSync: l.codigoSync,
    quien: l.quien,
    habilitado: l.habilitado,
    direcciones: typeof l.direcciones === "string" ? JSON.parse(l.direcciones) : (l.direcciones ?? [])
  }));

  return {
    success: true,
    message: "logisticas obtenidas correctamente",
    data: logisticasFinal,
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
