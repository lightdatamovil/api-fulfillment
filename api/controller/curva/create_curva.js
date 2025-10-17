import { CustomException, Status, isNonEmpty, LightdataORM } from "lightdata-tools";

/**
 * Body esperado:
 * {
 *   nombre: string,
 *   didCategoria?: number[]   // opcional; si viene, asocia categorías a la curva
 * }
 */
export async function createCurva(dbConnection, req) {
    const { nombre, categorias } = req.body || {};
    const { userId } = req.user || {};

    const nombreTrim = isNonEmpty(nombre) ? String(nombre).trim() : "";
    if (!isNonEmpty(nombreTrim)) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Se requiere 'nombre' para crear la curva",
            status: Status.badRequest,
        });
    }

    // Crear curva
    const [didCurva] = await LightdataORM.insert({
        dbConnection,
        table: "curvas",
        quien: userId,
        data: { nombre: nombreTrim },
    });

    // Asociar categorías (opcional)
    const idsCat = Array.isArray(categorias)
        ? [...new Set(categorias.map(Number))].filter((n) => Number.isFinite(n) && n > 0)
        : [];

    if (idsCat.length > 0) {
        // (Opcional pero recomendado) verificar que existan las categorías
        // Ajustá el nombre de la tabla si tu catálogo se llama distinto (e.g. "categorias")
        await LightdataORM.select({
            dbConnection,
            table: "categorias",
            where: { did: idsCat },
            throwExceptionIfNotExists: true,
        });

        // Insert bulk en la tabla pivote
        // ⚠️ Ajustá el nombre si tu pivote real es otro; acá uso el que venías manejando.
        await LightdataORM.insert({
            dbConnection,
            table: "variantes_curvas", // o "curvas_categorias" si así se llama en tu schema
            quien: userId,
            data: idsCat.map((didCat) => ({
                did_curva: Number(didCurva),
                did_categoria: didCat,
            })),
        });
    }

    return {
        success: true,
        message: "Curva creada correctamente",
        data: {
            did: didCurva,
            nombre: nombreTrim,
            categorias_asociadas: idsCat.length,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
