// variantes.controller.js
import { toStr, toBool01, pickNonEmpty } from "lightdata-tools";
import {
    SqlWhere,
    makePagination,
    makeSort,
    runPagedQuery,
    buildMeta,
} from "../../src/functions/query_utils.js";

/**
 * GET /variantes
 * Query: nombre, codigo, habilitado, (page|pagina), (page_size|cantidad), (sort_by|sortBy), (sort_dir|sortDir)
 * Tabla: variantes_categorias
 */
export async function getFilteredVariantes(connection, req) {
    const q = req.query;

    // Aliases para paginación y orden
    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    // Filtros normalizados (principal: nombre)
    const filtros = {
        nombre: toStr(q.nombre),
        codigo: toStr(q.codigo),
        habilitado: toBool01(q.habilitado, undefined), // 0/1 o undefined
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
        codigo: "vc.codigo",
        descripcion: "vc.descripcion",
        habilitado: "vc.habilitado",
        orden: "vc.orden",
        id: "vc.id",
        did: "vc.did",
    };
    const { orderSql } = makeSort(qp, sortMap, {
        defaultKey: "codigo",
        byKey: "sort_by",
        dirKey: "sort_dir",
    });

    // WHERE (incluye ESCAPE para LIKE)
    const where = new SqlWhere()
        .add("vc.elim = 0")
        .add("vc.superado = 0");

    if (filtros.habilitado !== undefined) where.eq("vc.habilitado", filtros.habilitado);
    if (filtros.codigo) where.likeEscaped("vc.codigo", filtros.codigo, { caseInsensitive: true });
    if (filtros.nombre) where.likeEscaped("vc.nombre", filtros.nombre, { caseInsensitive: true });

    const { whereSql, params } = where.finalize();

    // SELECT + COUNT con los mismos WHERE/PARAMS
    const { rows, total } = await runPagedQuery(connection, {
        select:
            "vc.id, vc.did, vc.nombre, vc.codigo, vc.descripcion, vc.habilitado, vc.orden",
        from: "FROM variantes_categorias vc",
        whereSql,
        orderSql,
        params,
        pageSize,
        offset,
    });

    // Meta + filtros (solo los que vinieron)
    const filtersForMeta = pickNonEmpty({
        nombre: filtros.nombre,
        codigo: filtros.codigo,
        ...(filtros.habilitado !== undefined ? { habilitado: filtros.habilitado } : {}),
    });

    return {
        success: true,
        message: "Variantes obtenidas correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
