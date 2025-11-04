import { pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta, } from "../../src/functions/query_utils.js";

export async function getFilteredInsumos({ db, req }) {
    const q = req.query;

    const { page, pageSize, offset } = makePagination(q, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    const sortMap = {
        nombre: "i.nombre",
        codigo: "i.codigo",
        habilitado: "i.habilitado",
    };
    const { orderSql } = makeSort(q, sortMap, { defaultKey: "nombre", byKey: "sort_by", dirKey: "sort_dir" });

    const where = new SqlWhere()
        .add("i.elim = 0")
        .add("i.superado = 0");

    if (q.codigo) where.likeEscaped("i.codigo", q.codigo);
    if (q.nombre) where.likeEscaped("i.nombre", q.nombre);

    const habRaw = q.habilitado;
    if (habRaw !== null && habRaw !== undefined && habRaw !== "todos" && habRaw !== "") {
        const hab = Number(habRaw);
        if (hab === 0 || hab === 1) where.eq("i.habilitado", hab);
    }

    const { whereSql, params } = where.finalize();

    const { rows, total } = await runPagedQuery(db, {
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
