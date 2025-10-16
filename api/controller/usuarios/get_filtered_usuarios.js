import { toStr, toBool, toIntList, pickNonEmpty, } from "lightdata-tools";
import { SqlWhere, makePagination, makeSort, runPagedQuery, buildMeta, } from "../../src/functions/query_utils.js";

export async function getFilteredUsuarios(connection, req) {
    const q = req.query;


    // --- paginación & orden ---
    const { page, pageSize, offset } = makePagination(q, { maxPageSize: 100, pageKey: "page", pageSizeKey: "page_size" });
    const sortMap = {
        nombre: "nombre",
        apellido: "apellido",
        email: "email",
        perfil: "perfil",
        habilitado: "habilitado",
        usuario: "usuario",
    };
    const { orderSql } = makeSort(q, sortMap, { defaultKey: "nombre", byKey: "sort_by", dirKey: "sort_dir" });

    // --- WHERE ---
    const userId = Number(req.user.userId);
    const where = new SqlWhere()
        .add("superado = 0")
        .add("elim = 0")
        .neq("did", userId);

    // --- filtros normalizados ---
    const filtros = {
        nombre: toStr(q.nombre),
        usuario: toStr(q.usuario),
        apellido: toStr(q.apellido),
        email: toStr(q.email),
        perfiles: toIntList(q.perfil),
        habilitado: toBool(q.habilitado, undefined), // 0/1 o undefined
    };

    if (Array.isArray(filtros.perfiles) && filtros.perfiles.length === 1) {
        where.eq("perfil", filtros.perfiles[0]);
    } else if (Array.isArray(filtros.perfiles) && filtros.perfiles.length > 1) {
        where.in("perfil", filtros.perfiles);
    }

    where
        .likeCI("nombre", filtros.nombre)
        .likeCI("apellido", filtros.apellido)
        .likeCI("email", filtros.email)
        .likeCI("usuario", filtros.usuario)
        .eq("habilitado", filtros.habilitado);

    const { whereSql, params } = where.finalize();

    // --- SELECT + COUNT ---
    const { rows, total } = await runPagedQuery(connection, {
        select:
            "did, perfil, nombre, apellido, email AS email, usuario, habilitado, modulo_inicial, app_habilitada, telefono, codigo_cliente",
        from: "FROM usuarios",
        whereSql,
        orderSql,
        params,
        pageSize,
        offset,
    });

    // --- meta ---
    const filtersForMeta = pickNonEmpty({
        nombre: filtros.nombre,
        usuario: filtros.usuario,
        apellido: filtros.apellido,
        email: filtros.email,
        habilitado: filtros.habilitado,
        perfiles: Array.isArray(filtros.perfiles) && filtros.perfiles.length ? filtros.perfiles : undefined,
    });

    return {
        success: true,
        message: "Usuarios obtenidos correctamente",
        data: rows,
        meta: buildMeta({ page, pageSize, totalItems: total, filters: filtersForMeta }),
    };
}
