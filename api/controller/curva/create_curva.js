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

    const [didCurva] = await LightdataORM.insert({
        dbConnection,
        table: "curvas",
        quien: userId,
        data: { nombre: nombreTrim },
    });

    if (variantes.length > 0) {
        const validIds = variantes
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        if (validIds.length > 0) {
            await LightdataORM.select({
                dbConnection,
                table: "variantes",
                where: { did: validIds },
                throwExceptionIfNotExists: true,
            });

            await LightdataORM.insert({
                dbConnection,
                table: "variantes_curvas",
                quien: userId,
                data: validIds.map((didVariante) => ({
                    did_curva: Number(didCurva),
                    did_variante: Number(didVariante),
                })),
            });
        }
    }

    return {
        success: true,
        message: "Curva creada correctamente",
        data: {
            did: didCurva,
            nombre: nombreTrim,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
