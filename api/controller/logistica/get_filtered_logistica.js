// logisticas.controller.js
import { executeQuery, toStr, toBool, pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, buildMeta } from "../../src/functions/query_utils.js";

export async function getFilteredLogisticas(connection, req) {
  const q = req.query;

  const qp = { ...q, page: q.page ?? q.pagina, page_size: q.page_size ?? q.cantidad };

  // Filtros
  const filtros = {
    nombre: toStr(q.nombre),
    codigo: toStr(q.codigo),
    codigoLD: toStr(q.codigoLD),
    logisticaLD: toStr(q.logisticaLD ?? q.logisticaLD, undefined),
    habilitado: toBool(q.habilitado ?? q.habilitado, undefined),
    //agregar u filtro todos que sea bool 1 o 0
  };

  // Paginación y orden
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
    codigoLD: "l.codigoLD",
    logisticaLD: "l.logisticaLD",
  };
  const { orderSql } = makeSort(q, sortMap, {
    defaultKey: "nombre",
    byKey: "sort_by",
    dirKey: "sort_dir",
  });

  // WHERE (con LIKE escapado dentro de helper)
  const where = new SqlWhere().add("l.superado = 0").add("l.elim = 0");
  if (filtros.codigo) where.likeEscaped("l.codigo", filtros.codigo, { caseInsensitive: true });
  if (filtros.nombre) where.likeEscaped("l.nombre", filtros.nombre, { caseInsensitive: true });
  if (filtros.codigoLD) where.likeEscaped("l.codigoLD", filtros.codigoLD, { caseInsensitive: true });
  if (filtros.habilitado) where.eq("l.habilitado", true);
  if (filtros.logisticaLD !== undefined && filtros.logisticaLD !== "todos") where.eq("l.logisticaLD", toBool(filtros.logisticaLD));

  const { whereSql, params } = where.finalize();

  // COUNT sin los LEFT JOIN (más preciso y rápido)
  const countSql = `SELECT COUNT(*) AS total FROM logisticas l ${whereSql}`;
  const [{ total = 0 } = {}] = await executeQuery(connection, countSql, params);

  // DATA: una sola query con subqueries agregadas (evita cross-product)
  const dataSql = `
SELECT
  l.did,
  l.nombre,
  l.logisticaLD,
  l.codigo,
  l.codigoLD,
  l.quien,
  l.habilitado,
   CASE
    WHEN COUNT(d.id) = 0 THEN JSON_ARRAY()
    ELSE JSON_ARRAYAGG(
      JSON_OBJECT(
        'id', d.id,
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
  l.did, l.nombre, l.logisticaLD, l.codigo, l.codigoLD, l.quien, l.habilitado
${orderSql /* calificado: ORDER BY l.nombre ASC, por ej. */}
LIMIT ? OFFSET ?;
  `;

  const rows = await executeQuery(connection, dataSql, [...params, pageSize, offset], true);

  // Parse seguro (depende de tu driver, a veces ya viene como objeto)
  const logisticasFinal = rows.map(l => ({
    did: l.did,
    nombre: l.nombre,
    logisticaLD: l.logisticaLD,
    codigo: l.codigo,
    codigoLD: l.codigoLD,
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
