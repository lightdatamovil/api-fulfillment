import { isNonEmpty, LightdataORM } from "lightdata-tools";

/**
 * Versionado de curva (PUT) usando LightdataORM:
 * - Verifica existencia de curva vigente (elim=0, superado=0).
 * - Crea NUEVA versión con el MISMO did usando LightdataORM.update()
 *   (no hace falta insert manual).
 * - Si viene "categorias" (number[]):
 *     * versiona (delete lógico) los links vigentes en variantes_categorias_curvas
 *     * inserta los nuevos links.
 *
 * Body:
 *   did: number (requerido)
 *   nombre?: string
 *   categorias?: number[]   // opcional
 */
export async function updateCurva(dbConnection, req) {
    const { did, nombre, categorias } = req.body || {};
    const { userId } = req.user || {};

    const didCurva = Number(did);

    const [curr] = await LightdataORM.select({
        dbConnection,
        table: "curvas",
        where: { did: didCurva },
        throwExceptionIfNotExists: true,
    });

    const newNombre = isNonEmpty(nombre) ? String(nombre).trim() : curr.nombre;

    const idVersionNueva = await LightdataORM.update({
        dbConnection,
        table: "curvas",
        where: { did: didCurva },
        quien: userId,
        data: { nombre: newNombre },
    });

    if (categorias.length > 0) {
        const validIds = categorias
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        if (validIds.length > 0) {
            await LightdataORM.select({
                dbConnection,
                table: "variantes_categorias",
                where: { did: validIds },
                throwExceptionIfNotExists: true,
            });
        }

        const linksVigentes = await LightdataORM.select({
            dbConnection,
            table: "variantes_categorias_curvas",
            where: { did_curva: didCurva },
        });

        if (linksVigentes.length > 0) {
            await LightdataORM.delete({
                dbConnection,
                table: "variantes_categorias_curvas",
                where: { did: linksVigentes },
                quien: userId,
            });
        }

        await LightdataORM.insert({
            dbConnection,
            table: "variantes_categorias_curvas",
            quien: userId,
            data: validIds.map((didCategoria) => ({
                did_curva: didCurva,
                did_categoria: didCategoria,
            })),
        });
    }

    return {
        success: true,
        message: "Curva versionada correctamente",
        data: {
            did: didCurva,
            idVersionNueva,
            nombre: newNombre,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
