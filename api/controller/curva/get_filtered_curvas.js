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

    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    const filtros = {
        nombre: toStr(q.nombre),
    };

    const { page, pageSize, offset } = makePagination(qp, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    const sortMap = {
        nombre: "vc.nombre",
        did: "vc.did",
        id: "vc.id",
        habilitado: "vc.habilitado",
        codigo: "vc.codigo",
    };
    const { orderSql } = makeSort(qp, sortMap, {
        defaultKey: "nombre",
        byKey: "sort_by",
        dirKey: "sort_dir",
    });

    const where = new SqlWhere()
        .add("vc.elim = 0")
        .add("vc.superado = 0");

    if (filtros.nombre) where.likeEscaped("vc.nombre", filtros.nombre, { caseInsensitive: true });

    const { whereSql, params } = where.finalize();

    const { rows, total } = await runPagedQuery(connection, {
        select: "vc.id, vc.did, vc.nombre.vcodigo, vc.habilitado",
        from: "FROM curvas vc",
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
