// controller/variantes/update_curva.js
import { CustomException, Status, isNonEmpty, LightdataQuerys } from "lightdata-tools";

/**
 * Versionado de curva (PUT) usando LightdataQuerys:
 * - Supera la versión vigente de curvas para el did dado.
 * - Inserta nueva versión con el mismo did (id cambia internamente).
 * - Si viene "categorias" (number[]), supera links vigentes en variantes_categorias_curvas
 *   y re-inserta los nuevos. Si no viene, no toca links.
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
    if (!Number.isFinite(didCurva) || didCurva <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "Se requiere 'did' numérico válido",
            status: Status.badRequest,
        });
    }

    // 1) Traer versión vigente actual de la curva (elim=0, superado=0)
    const [curr] = await LightdataQuerys.select({
        dbConnection,
        table: "curvas",
        column: "did",
        value: didCurva,
        throwExceptionIfNotExists: true,
    });

    if (Number(curr.elim ?? 0) !== 0 || Number(curr.superado ?? 0) !== 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No existe una curva vigente con did ${didCurva}`,
            status: Status.notFound,
        });
    }

    const newNombre = isNonEmpty(nombre) ? String(nombre).trim() : curr.nombre;

    // 2) Superar versión vigente
    await LightdataQuerys.update({
        dbConnection,
        table: "curvas",
        did: didCurva,
        quien: userId,
        data: { superado: 1 },
    });

    // 3) Insertar nueva versión (con el mismo did)
    const [idVersionNueva] = await LightdataQuerys.insert({
        dbConnection,
        table: "curvas",
        quien: userId,
        data: {
            did: didCurva,
            nombre: newNombre,
            superado: 0,
            elim: 0,
        },
    });

    // 4) Links (solo si viene "categorias")
    let linked;
    if (Array.isArray(categorias)) {
        // Normalizar IDs
        const validIds = categorias
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        // Validar existencia de categorías vigentes en variantes_categorias
        if (validIds.length > 0) {
            for (const didCategoria of validIds) {
                const [cat] = await LightdataQuerys.select({
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
        }

        // 4.a) Superar links vigentes (por did_curva)
        const linksVigentes = await LightdataQuerys.select({
            dbConnection,
            table: "variantes_categorias_curvas",
            column: "did_curva",
            value: didCurva,
        });

        for (const l of linksVigentes) {
            if (Number(l.elim ?? 0) === 0 && Number(l.superado ?? 0) === 0) {
                await LightdataQuerys.update({
                    dbConnection,
                    table: "variantes_categorias_curvas",
                    did: Number(l.did),
                    quien: userId,
                    data: { superado: 1 },
                });
            }
        }

        // 4.b) Insertar nuevos links (misma curva)
        linked = 0;
        for (const didCategoria of validIds) {
            await LightdataQuerys.insert({
                dbConnection,
                table: "variantes_categorias_curvas",
                quien: userId,
                data: {
                    did_curva: didCurva,
                    did_categoria: didCategoria,
                    superado: 0,
                    elim: 0,
                },
            });
            linked += 1;
        }
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
