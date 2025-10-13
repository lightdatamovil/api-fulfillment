// controller/variantes/update_curva.js
import { CustomException, Status, isNonEmpty, LightdataORM } from "lightdata-tools";

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
        did: didCurva,
        quien: userId,
        data: { nombre: newNombre },
    });

    let linked;
    if (Array.isArray(categorias)) {
        const validIds = categorias
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        for (const didCategoria of validIds) {
            const [cat] = await LightdataORM.select({
                dbConnection,
                table: "variantes_categorias",
                column: "did",
                value: didCategoria,
                throwExceptionIfNotExists: true,
            });
            if (Number(cat.elim ?? 0) !== 0 || Number(cat.superado ?? 0) !== 0) {
                throw new CustomException({
                    title: "Categorías no encontradas",
                    message: `No existe/activa la categoría ${didCategoria}`,
                    status: Status.badRequest,
                });
            }
        }

        const linksVigentes = await LightdataORM.select({
            dbConnection,
            table: "variantes_categorias_curvas",
            column: "did_curva",
            value: didCurva,
        });

        const didsLinksVigentes = linksVigentes
            .filter((l) => Number(l.elim ?? 0) === 0 && Number(l.superado ?? 0) === 0)
            .map((l) => Number(l.did));

        if (didsLinksVigentes.length > 0) {
            await LightdataORM.delete({
                dbConnection,
                table: "variantes_categorias_curvas",
                where: { did: didsLinksVigentes },
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
            ...(linked !== undefined ? { categoriasVinculadas: linked } : {}),
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
