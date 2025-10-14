import { isNonEmpty, LightdataORM } from "lightdata-tools";

/**
 * Versionado de curva (PUT) usando LightdataORM:
 * - Verifica existencia de curva vigente (elim=0, superado=0).
 * - Crea NUEVA versión con el MISMO did usando LightdataORM.update()
 *   (no hace falta insert manual).
 * - Si viene "variantes" (number[]):
 *     * versiona (delete lógico) los links vigentes en variantes_variantes_curvas
 *     * inserta los nuevos links.
 *
 * Body:
 *   did: number (requerido)
 *   nombre?: string
 *   variantes?: number[]   // opcional
 */
export async function editCurva(dbConnection, req) {
    const { nombre, variantes } = req.body;
    const { userId } = req.user;
    const { curvaDid } = req.params;

    const cAdd = variantes?.add;
    const cDel = variantes?.remove;

    const [curr] = await LightdataORM.select({
        dbConnection,
        table: "curvas",
        where: { did: curvaDid },
        throwExceptionIfNotExists: true,
    });

    const newNombre = isNonEmpty(nombre) ? String(nombre).trim() : curr.nombre;

    await LightdataORM.update({
        dbConnection,
        table: "curvas",
        where: { did: curvaDid },
        quien: userId,
        data: { nombre: newNombre },
    });

    if (cAdd.length > 0) {
        await LightdataORM.insert({
            dbConnection,
            table: "variantes_curvas",
            quien: userId,
            data: cAdd.map(c => ({ did_variante: c, did_curva: curvaDid }))
        });
    }

    if (cDel.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_curvas",
            where: { did: cDel },
            quien: userId,
        });
    }

    return {
        success: true,
        message: "Curva versionada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
