import { isNonEmpty, LightdataORM, CustomException, Status } from "lightdata-tools";

export async function editCurva({ db, req }) {
    const { nombre, categorias, codigo, habilitado } = req.body || {};
    const { userId } = req.user || {};
    const curvaDid = Number(req.params?.curvaDid);

    if (!Number.isFinite(curvaDid) || curvaDid <= 0) {
        throw new CustomException({
            title: "Parámetros inválidos",
            message: "curvaDid debe ser un número válido en la URL",
            status: Status.badRequest,
        });
    }

    const normIds = (arr) =>
        Array.isArray(arr)
            ? [...new Set(arr.map(Number))].filter((n) => Number.isFinite(n) && n > 0)
            : [];

    const addIds = normIds(categorias?.add);
    const delIds = normIds(categorias?.remove);

    const [curr] = await LightdataORM.select({
        db,
        table: "curvas",
        where: { did: curvaDid },
        throwExceptionIfNotExists: true,
    });

    const newNombre = isNonEmpty(nombre) ? String(nombre).trim() : curr.nombre;

    await LightdataORM.update({
        db,
        table: "curvas",
        where: { did: curvaDid },
        quien: userId,
        data: {
            nombre: newNombre,
            codigo: isNonEmpty(codigo) ? String(codigo).trim() : null,
            habilitado: habilitado ? 1 : 0
        },
    });

    if (addIds.length > 0) {
        await LightdataORM.select({
            db,
            table: "variantes_categorias",
            where: { did: addIds },
            throwExceptionIfNotExists: true,
        });

        await LightdataORM.insert({
            db,
            table: "variantes_curvas",
            quien: userId,
            data: addIds.map((didCat) => ({
                did_curva: curvaDid,
                did_categoria: didCat,
            })),
        });
    }

    if (delIds.length > 0) {
        await LightdataORM.delete({
            db,
            table: "variantes_curvas",
            where: { did_curva: curvaDid, did_categoria: delIds },
            quien: userId,
        });
    }

    return {
        success: true,
        message: "Curva versionada correctamente",
        data: {
            did: curvaDid,
            nombre: newNombre,
            categorias: {
                agregadas: addIds.length,
                removidas: delIds.length,
            },
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
