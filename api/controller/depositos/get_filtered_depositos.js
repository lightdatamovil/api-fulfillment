import { toStr, pickNonEmpty } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta } from "../../src/functions/query_utils.js";

export async function getFilteredDepositos({ db, req }) {
    const q = req.query;

    const qp = {
        ...q,
        page: q.page ?? q.pagina,
        page_size: q.page_size ?? q.cantidad,
        sort_by: q.sort_by ?? q.sortBy,
        sort_dir: q.sort_dir ?? q.sortDir,
    };

    const filtros = {
        direccion: toStr(q.direccion),
        descripcion: toStr(q.descripcion),
        codigo: toStr(q.codigo),
        email: toStr(q.email),
        telefono: toStr(q.telefono),
    };

    const { page, pageSize, offset } = makePagination(qp, {
        pageKey: "page",
        pageSizeKey: "page_size",
        defaultPage: 1,
        defaultPageSize: 10,
        maxPageSize: 100,
    });

    const sortMap = {
        did: "d.did",
        id: "d.id",
        direccion: "d.direccion",
        codigo: "d.codigo",
        email: "d.email",
        telefono: "d.telefono",
    };
    const { orderSql } = makeSort(qp, sortMap, {
        defaultKey: "direccion",
        byKey: "sort_by",
        dirKey: "sort_dir",
    });

    const where = new SqlWhere()
        .add("d.elim = 0")
        .add("d.superado = 0");

    if (filtros.direccion) where.likeEscaped("d.direccion", filtros.direccion, { caseInsensitive: true });
    if (filtros.descripcion) where.likeEscaped("d.descripcion", filtros.descripcion, { caseInsensitive: true });
    if (filtros.codigo) where.likeEscaped("d.codigo", filtros.codigo, { caseInsensitive: true });
    if (filtros.email) where.likeEscaped("d.email", filtros.email, { caseInsensitive: true });
    if (filtros.telefono) where.likeEscaped("d.telefono", filtros.telefono, { caseInsensitive: true });

    const { whereSql, params } = where.finalize();

    const { rows, total } = await runPagedQuery(db, {
        select: "d.id, d.did, d.direccion, d.descripcion, d.codigo, d.email, d.telefono",
        from: "FROM depositos d",
        whereSql,
        orderSql,
        params,
        pageSize,
        offset,
    });

    const filtersForMeta = pickNonEmpty({ ...filtros });

    return {
        success: true,
        message: "Depósitos obtenidos correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
