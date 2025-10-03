import { pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta, } from "../../src/functions/query_utils.js";

export async function getFilteredInsumos(dbConnection, req) {
    const q = req.query;

    // paginación (notar pageSize camelCase)
    const { page, pageSize, offset } = makePagination(q, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    // orden seguro
    const sortMap = {
        nombre: "i.nombre",
        codigo: "i.codigo",
        habilitado: "i.habilitado",
    };
    const { orderSql } = makeSort(q, sortMap, { defaultKey: "nombre", byKey: "sort_by", dirKey: "sort_dir" });

    // WHERE hace el where
    const where = new SqlWhere()
        .add("i.elim = 0")
        .add("i.superado = 0");

    // filtros condiciones opcionales
    if (q.codigo) where.likeEscaped("i.codigo", q.codigo);
    if (q.nombre) where.likeEscaped("i.nombre", q.nombre);

    //q es params -- parseo habilitado de params
    const habRaw = q.habilitado;
    if (habRaw !== null && habRaw !== undefined && habRaw !== "todos" && habRaw !== "") {
        const hab = Number(habRaw);
        if (hab === 0 || hab === 1) where.eq("i.habilitado", hab);
    }

    const { whereSql, params } = where.finalize();

    // SELECT + COUNT
    const { rows, total } = await runPagedQuery(dbConnection, {
        select: "i.did, i.nombre, i.codigo, i.habilitado",
        from: "FROM insumos i",
        whereSql,
        orderSql,
        params,
        pageSize,
        offset,
    });

    const filtersForMeta = pickNonEmpty({
        nombre: q.nombre,
        codigo: q.codigo,
        ...(habRaw !== "todos" && habRaw !== "" && habRaw !== undefined
            ? { habilitado: Number.isFinite(Number(habRaw)) ? Number(habRaw) : habRaw }
            : {}),
    });

    return {
        success: true,
        message: "Insumos obtenidos correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
