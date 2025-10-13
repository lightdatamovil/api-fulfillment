import { isNonEmpty, isDefined, number01, CustomException, Status, LightdataORM } from "lightdata-tools";

/**
 * Crea una variante (raíz) y opcionalmente sus categorías y valores.
 * Requiere: codigo, nombre
 * Opcionales: descripcion, habilitado (0/1), orden, categorias: [{ nombre, valores?: [{ nombre }] }]
 */
export async function createVariante(dbConnection, req) {
    const { codigo, nombre, descripcion, habilitado, orden, categorias } = req.body;
    const userId = Number(req.user?.userId ?? req.user?.id ?? 0) || null;

    const codigoTrim = String(codigo ?? "").trim();
    const nombreTrim = String(nombre ?? "").trim();
    const descTrim = isNonEmpty(descripcion) ? String(descripcion).trim() : null;

    if (!isNonEmpty(codigoTrim) || !isNonEmpty(nombreTrim)) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Se requieren 'codigo' y 'nombre' para crear la variante",
            status: Status.badRequest,
        });
    }

    let habValue = 1;
    if (isDefined(habilitado)) {
        const hab = number01(habilitado);
        if (hab !== 0 && hab !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "habilitado debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        habValue = hab;
    }

    const ordenValue = Number.isFinite(Number(orden)) ? Number(orden) : 0;

    await LightdataORM.select({
        dbConnection,
        table: "variantes",
        column: "codigo",
        value: codigoTrim,
        throwExceptionIfAlreadyExists: true,
    });

    const [idVariante] = await LightdataORM.insert({
        dbConnection,
        table: "variantes",
        quien: userId,
        data: {
            codigo: codigoTrim,
            nombre: nombreTrim,
            descripcion: descTrim,
            orden: ordenValue,
            habilitado: habValue,
        },
    });

    const insertedCategorias = [];

    if (Array.isArray(categorias) && categorias.length > 0) {
        for (const cat of categorias) {
            const nombreCat = String(cat?.nombre ?? "").trim();
            if (!isNonEmpty(nombreCat)) {
                throw new CustomException({
                    title: "Datos incompletos en categoría",
                    message: "Cada categoría debe incluir 'nombre'",
                    status: Status.badRequest,
                });
            }

            const [idCategoria] = await LightdataORM.insert({
                dbConnection,
                table: "variantes_categorias",
                quien: userId,
                data: {
                    did_variante: idVariante,
                    nombre: nombreCat,
                },
            });

            const valores = Array.isArray(cat?.valores) ? cat.valores : [];
            const insertedVals = [];

            for (const v of valores) {
                const nombreVal = String(v?.nombre ?? "").trim();
                if (!isNonEmpty(nombreVal)) {
                    throw new CustomException({
                        title: "Datos incompletos en valores",
                        message: "Cada valor debe incluir 'nombre'",
                        status: Status.badRequest,
                    });
                }

                const [idVal] = await LightdataORM.insert({
                    dbConnection,
                    table: "variantes_categoria_valores",
                    quien: userId,
                    data: {
                        did_categoria: idCategoria,
                        nombre: nombreVal,
                    },
                });

                insertedVals.push({ did: idVal, nombre: nombreVal });
            }

            insertedCategorias.push({
                did: idCategoria,
                did_variante: idVariante,
                nombre: nombreCat,
                valores: insertedVals,
            });
        }
    }

    return {
        success: true,
        message: "Variante creada correctamente",
        data: {
            variante: {
                did: idVariante,
                codigo: codigoTrim,
                nombre: nombreTrim,
                descripcion: descTrim,
                habilitado: habValue,
                orden: ordenValue,
            },
            categorias: insertedCategorias,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
