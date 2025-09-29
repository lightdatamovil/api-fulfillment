import { toStr, toBool01, pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta } from "../../src/functions/query_utils.js";

/**
 * GET /productos
 * Query soportados:
 *  - titulo (LIKE)
 *  - did_cliente (EQ)
 *  - habilitado (0/1)
 *  - es_combo (0/1)
 *  - (page|pagina), (page_size|cantidad), (sort_by|sortBy), (sort_dir|sortDir)
 *
 * Tabla: producto (vigentes y no eliminados)
 */
export async function getFilteredProductos(connection, req) {
    const q = req.query;

    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    const filtros = {
        titulo: toStr(q.titulo),
        did_cliente: Number.isFinite(Number(q.did_cliente)) ? Number(q.did_cliente) : undefined,
        habilitado: toBool01(q.habilitado, undefined), // 0/1 o undefined
        es_combo: toBool01(q.es_combo, undefined),     // 0/1 o undefined
    };

    const { page, pageSize, offset } = makePagination(qp, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    const sortMap = {
        titulo: "p.titulo",
        did: "p.did",
        did_cliente: "p.did_cliente",
        habilitado: "p.habilitado",
        es_combo: "p.es_combo",
        posicion: "p.posicion",
    };
    const { orderSql } = makeSort(qp, sortMap, {
        defaultKey: "titulo",
        byKey: "sort_by",
        dirKey: "sort_dir",
    });

    const where = new SqlWhere()
        .add("p.elim = 0")
        .add("p.superado = 0");

    if (filtros.titulo) where.likeEscaped("p.titulo", filtros.titulo, { caseInsensitive: true });
    if (filtros.did_cliente !== undefined) where.eq("p.did_cliente", filtros.did_cliente);
    if (filtros.habilitado !== undefined) where.eq("p.habilitado", filtros.habilitado);
    if (filtros.es_combo !== undefined) where.eq("p.es_combo", filtros.es_combo);

    const { whereSql, params } = where.finalize();

    const { rows, total } = await runPagedQuery(connection, {
        select: `
      p.did, p.did_cliente, p.titulo, p.descripcion, p.imagen,
      p.habilitado, p.es_combo, p.posicion, p.cm3, p.alto, p.ancho, p.profundo
    `,
        from: "FROM productos p",
        whereSql,
        orderSql,
        params,
        pageSize,
        offset,
    });

    const filtersForMeta = pickNonEmpty({
        titulo: filtros.titulo,
        ...(filtros.did_cliente !== undefined ? { did_cliente: filtros.did_cliente } : {}),
        ...(filtros.habilitado !== undefined ? { habilitado: filtros.habilitado } : {}),
        ...(filtros.es_combo !== undefined ? { es_combo: filtros.es_combo } : {}),
    });

    return {
        success: true,
        message: "Productos obtenidos correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
