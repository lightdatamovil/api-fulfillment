// controller/variantes/update_curva.js
import { CustomException, Status, isNonEmpty, LightdataQuerys } from "lightdata-tools";

/**
 * Versionado de curva (PUT) usando LightdataQuerys:
 * - Verifica existencia de curva vigente (elim=0, superado=0).
 * - Crea NUEVA versión con el MISMO did usando LightdataQuerys.update()
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
    if (!Number.isFinite(didCurva) || didCurva <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "Se requiere 'did' numérico válido",
            status: Status.badRequest,
        });
    }

    const quien = Number(userId);
    if (!Number.isFinite(quien) || quien <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "Usuario no identificado para versionar",
            status: Status.badRequest,
        });
    }

    // 1) Verificar que exista curva vigente
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

    // 2) Versionar la curva en UNA sola operación
    //    LightdataQuerys.update:
    //      - marca versiones actuales como superadas
    //      - inserta nueva versión con mismo did, quien, superado=0, elim=0
    const idVersionNueva = await LightdataQuerys.update({
        dbConnection,
        table: "curvas",
        did: didCurva,
        quien,
        data: { nombre: newNombre }, // solo campos que cambian
    });

    // 3) Links (solo si viene "categorias")
    let linked;
    if (Array.isArray(categorias)) {
        // Normalizar y filtrar IDs válidos
        const validIds = categorias
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        // 3.a) Validar existencia de categorías vigentes
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

        // 3.b) Traer links vigentes por did_curva
        const linksVigentes = await LightdataQuerys.select({
            dbConnection,
            table: "variantes_categorias_curvas",
            column: "did_curva",
            value: didCurva,
        });

        // 3.c) Versionar (delete lógico) todos los links vigentes en una sola pasada
        const didsLinksVigentes = linksVigentes
            .filter((l) => Number(l.elim ?? 0) === 0 && Number(l.superado ?? 0) === 0)
            .map((l) => Number(l.did));

        if (didsLinksVigentes.length > 0) {
            await LightdataQuerys.delete({
                dbConnection,
                table: "variantes_categorias_curvas",
                did: didsLinksVigentes,
                quien,
            });
        }

        // 3.d) Insertar nuevos links (elim=0, superado=0 los setea el insert)
        linked = 0;
        for (const didCategoria of validIds) {
            await LightdataQuerys.insert({
                dbConnection,
                table: "variantes_categorias_curvas",
                quien,
                data: {
                    did_curva: didCurva,
                    did_categoria: didCategoria,
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
            idVersionNueva,          // ahora sale directo del update()
            nombre: newNombre,
            ...(linked !== undefined ? { categoriasVinculadas: linked } : {}),
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
