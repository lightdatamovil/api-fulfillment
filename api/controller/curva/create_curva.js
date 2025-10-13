import { CustomException, Status, isNonEmpty, LightdataORM } from "lightdata-tools";

/**
 * Crea una curva y, opcionalmente, asocia variantes a la curva.
 * Body:
 *   { nombre: string, variantes?: number[] }
 */
export async function createCurva(dbConnection, req) {
    const { nombre, variantes } = req.body;
    const { userId } = req.user;

    const nombreTrim = isNonEmpty(nombre) ? String(nombre).trim() : "";

    if (!isNonEmpty(nombreTrim)) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Se requiere 'nombre' para crear la curva",
            status: Status.badRequest,
        });
    }

    // Insert curva
    const [didCurva] = await LightdataORM.insert({
        dbConnection,
        table: "curvas",
        quien: userId,
        data: { nombre: nombreTrim, superado: 0, elim: 0 },
    });

    // Asociaciones opcionales con variantes
    let linked = 0;
    if (Array.isArray(variantes) && variantes.length > 0) {
        const validIds = variantes
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        if (validIds.length !== variantes.length) {
            throw new CustomException({
                title: "Variantes inválidas",
                message: "Todas las variantes deben ser números válidos",
                status: Status.badRequest,
            });
        }

        // Validar existencia de cada variante vigente (elim=0, superado=0)
        for (const didVariante of validIds) {
            const [varRow] = await LightdataORM.select({
                dbConnection,
                table: "variantes",
                column: "did",
                value: didVariante,
                throwExceptionIfNotExists: true,
            });

            if (Number(varRow.elim ?? 0) !== 0 || Number(varRow.superado ?? 0) !== 0) {
                throw new CustomException({
                    title: "Variantes no encontradas",
                    message: `No existe/activa la variante ${didVariante}`,
                    status: Status.badRequest,
                });
            }

            // Reactivar link si existía (elim=1/superado=1) o insertar si no existía
            // Primero intento UPDATE por clave compuesta
            await LightdataORM.update({
                dbConnection,
                table: "variantes_curvas",
                quien: userId,
                // Se asume que LightdataORM.update soporta where por columnas
                where: { did_curva: Number(didCurva), did_variante: Number(didVariante) },
                data: { elim: 0, superado: 0 },
            });

            // Luego inserto (si ya existía el par activo, el índice único debería evitar duplicados)
            await LightdataORM.insert({
                dbConnection,
                table: "variantes_curvas",
                quien: userId,
                data: {
                    did_curva: Number(didCurva),
                    did_variante: Number(didVariante),
                    superado: 0,
                    elim: 0,
                },
            });

            linked += 1;
        }
    }

    return {
        success: true,
        message: "Curva creada correctamente",
        data: {
            did: didCurva,
            nombre: nombreTrim,
            categoriasVinculadas: linked,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
