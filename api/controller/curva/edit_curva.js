import { isNonEmpty, LightdataORM, CustomException, Status } from "lightdata-tools";

/**
 * PUT /curvas/:curvaDid
 *
 * Body:
 * {
 *   nombre?: string,
 *   categorias?: {
 *     add?: number[],      // DIDs de categorias a vincular
 *     remove?: number[]    // DIDs de categorias a desvincular (delete lógico)
 *   }
 * }
 */
export async function editCurva(dbConnection, req) {
    const { nombre, categorias } = req.body || {};
    const { userId } = req.user || {};
    const curvaDid = Number(req.params?.curvaDid);

    if (!Number.isFinite(curvaDid) || curvaDid <= 0) {
        throw new CustomException({
            title: "Parámetros inválidos",
            message: "curvaDid debe ser un número válido en la URL",
            status: Status.badRequest,
        });
    }

    // Normalización de arrays (dedupe + solo números > 0)
    const normIds = (arr) =>
        Array.isArray(arr)
            ? [...new Set(arr.map(Number))].filter((n) => Number.isFinite(n) && n > 0)
            : [];

    const addIds = normIds(categorias?.add);
    const delIds = normIds(categorias?.remove);

    // 1) Verificar que la curva exista (vigente)
    const [curr] = await LightdataORM.select({
        dbConnection,
        table: "curvas",
        where: { did: curvaDid },
        throwExceptionIfNotExists: true,
    });

    // 2) Versionar la curva (solo nombre si vino)
    const newNombre = isNonEmpty(nombre) ? String(nombre).trim() : curr.nombre;

    await LightdataORM.update({
        dbConnection,
        table: "curvas",
        where: { did: curvaDid },
        quien: userId,
        data: { nombre: newNombre },
    });

    // 3) Vincular categorías nuevas (si las hay)
    if (addIds.length > 0) {
        // (Opcional pero sano) validar existencia de categorías
        await LightdataORM.select({
            dbConnection,
            table: "variantes_categorias",
            where: { did: addIds },
            throwExceptionIfNotExists: true,
        });

        // Insert bulk en pivote (usamos la misma pivote que ya tenías, con did_categoria)
        await LightdataORM.insert({
            dbConnection,
            table: "variantes_curvas", // pivote curva <-> categoría
            quien: userId,
            data: addIds.map((didCat) => ({
                did_curva: curvaDid,
                did_categoria: didCat,
            })),
        });
    }

    // 4) Desvincular categorías (delete lógico versionado) si las hay
    if (delIds.length > 0) {
        // delete versionado por condiciones (curva + listado de categorías)
        await LightdataORM.delete({
            dbConnection,
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
