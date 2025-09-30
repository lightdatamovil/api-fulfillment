import { toStr, pickNonEmpty } from "lightdata-tools";
import {
    SqlWhere,
    makePagination,
    makeSort,
    runPagedQuery,
    buildMeta,
} from "../../src/functions/query_utils.js";

/**
 * GET /curvas
 * Query: nombre, (page|pagina), (page_size|cantidad), (sort_by|sortBy), (sort_dir|sortDir)
 * Tabla: variantes_curvas
 */
export async function getFilteredCurvas(connection, req) {
    const q = req.query;

    // Aliases para paginación/orden
    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    // Filtros
    const filtros = {
        nombre: toStr(q.nombre),
    };

    // Paginación
    const { page, pageSize, offset } = makePagination(qp, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    // Orden (whitelist)
    const sortMap = {
        nombre: "vc.nombre",
        did: "vc.did",
        id: "vc.id",
    };
    const { orderSql } = makeSort(qp, sortMap, {
        defaultKey: "nombre",
        byKey: "sort_by",
        dirKey: "sort_dir",
    });

    // WHERE
    const where = new SqlWhere()
        .add("vc.elim = 0")
        .add("vc.superado = 0");

    if (filtros.nombre) where.likeEscaped("vc.nombre", filtros.nombre, { caseInsensitive: true });

    const { whereSql, params } = where.finalize();

    // SELECT + COUNT
    const { rows, total } = await runPagedQuery(connection, {
        select: "vc.id, vc.did, vc.nombre",
        from: "FROM variantes_curvas vc",
        whereSql,
        orderSql,
        params,
        pageSize,
        offset,
    });

    const filtersForMeta = pickNonEmpty({ nombre: filtros.nombre });

    return {
        success: true,
        message: "Curvas obtenidas correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
