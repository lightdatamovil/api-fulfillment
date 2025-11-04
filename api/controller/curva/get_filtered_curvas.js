import { toStr, pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta } from "../../src/functions/query_utils.js";

export async function getFilteredCurvas({ db, req }) {
    const q = req.query;

    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    const parseBoolish = (v) => {
        if (v === undefined || v === null || v === "") return undefined;
        if (typeof v === "boolean") return v;
        const s = String(v).trim().toLowerCase();
        if (s === "1" || s === "true") return true;
        if (s === "0" || s === "false") return false;
        return undefined;
    };

    const filtros = {
        nombre: toStr(q.nombre),
        codigo: toStr(q.codigo),
        habilitado: parseBoolish(q.habilitado),
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

    if (filtros.nombre)
        where.likeEscaped("vc.nombre", filtros.nombre, { caseInsensitive: true });

    if (filtros.codigo)
        where.likeEscaped("vc.codigo", filtros.codigo, { caseInsensitive: true });

    if (filtros.habilitado !== undefined)
        where.add("vc.habilitado = ?", filtros.habilitado ? 1 : 0);

    const { whereSql, params } = where.finalize();

    const { rows, total } = await runPagedQuery(db, {
        select: "vc.id, vc.did, vc.nombre, vc.codigo, vc.habilitado",
        from: "FROM curvas vc",
        whereSql,
        orderSql,
        params,
        pageSize,
        offset,
    });

    const filtersForMeta = pickNonEmpty({
        nombre: filtros.nombre,
        codigo: filtros.codigo,
        habilitado: filtros.habilitado,
    });

    return {
        success: true,
        message: "Curvas obtenidas correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
