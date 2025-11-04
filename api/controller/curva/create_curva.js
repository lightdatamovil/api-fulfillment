import { CustomException, Status, isNonEmpty, LightdataORM } from "lightdata-tools";

export async function createCurva({ db, req }) {
    const { nombre, categorias, codigo, habilitado } = req.body || {};
    const { userId } = req.user || {};

    const nombreTrim = isNonEmpty(nombre) ? String(nombre).trim() : "";
    if (!isNonEmpty(nombreTrim)) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Se requiere 'nombre' para crear la curva",
            status: Status.badRequest,
        });
    }

    const [didCurva] = await LightdataORM.insert({
        db,
        table: "curvas",
        quien: userId,
        data: {
            nombre: nombreTrim
            , codigo: isNonEmpty(codigo) ? String(codigo).trim() : null, habilitado: habilitado ? 1 : 0
        },
    });

    const idsCat = Array.isArray(categorias)
        ? [...new Set(categorias.map(Number))].filter((n) => Number.isFinite(n) && n > 0)
        : [];

    if (idsCat.length > 0) {
        await LightdataORM.select({
            db,
            table: "variantes_categorias",
            where: { did: idsCat },
            throwExceptionIfNotExists: true,
        });

        await LightdataORM.insert({
            db,
            table: "variantes_curvas",
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
