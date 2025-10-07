import {
    CustomException,
    executeQuery,
    Status,
    isNonEmpty,
    isDefined,
    number01,
} from "lightdata-tools";

/**
 * Crea una variante (raíz) y opcionalmente sus categorías y valores.
 * Requiere: codigo, nombre
 * Opcionales: descripcion, habilitado (0/1), orden, categorias: [{ nombre, valores?: [{ nombre }] }]
 * Sin transacciones. did == id (post-insert).
 */
export async function createVariante(dbConnection, req) {
    const { codigo, nombre, descripcion, habilitado, orden, categorias } = req.body;
    const userId = Number(req.user?.userId ?? req.user?.id ?? 0) || null;

    // -------- Normalizaciones --------
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

    // -------- Unicidad de código (variantes) --------
    const dup = await executeQuery(
        dbConnection,
        `SELECT did
       FROM variantes
      WHERE codigo = ? AND elim = 0 AND superado = 0
      LIMIT 1`,
        [codigoTrim]
    );
    if (dup?.length) {
        throw new CustomException({
            title: "Código duplicado",
            message: `Ya existe una variante activa con código "${codigoTrim}"`,
            status: Status.conflict,
        });
    }

    // -------- Insert variante --------
    const insVar = await executeQuery(
        dbConnection,
        `INSERT INTO variantes
       (did, codigo, nombre, descripcion, orden, habilitado, quien, superado, elim)
     VALUES (0, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [codigoTrim, nombreTrim, descTrim, ordenValue, habValue, userId],
        true
    );

    if (!insVar?.affectedRows) {
        throw new CustomException({
            title: "Error al crear variante",
            message: "No se pudo insertar la variante",
            status: Status.internalServerError,
        });
    }

    const idVariante = insVar.insertId;

    // set did = id
    await executeQuery(
        dbConnection,
        `UPDATE variantes SET did = ? WHERE id = ?`,
        [idVariante, idVariante],
        true
    );

    // -------- Categorías y valores (opcionales) --------
    const insertedCategorias = [];

    if (Array.isArray(categorias) && categorias.length) {
        for (const cat of categorias) {
            const nombreCat = String(cat?.nombre ?? "").trim();
            if (!isNonEmpty(nombreCat)) {
                throw new CustomException({
                    title: "Datos incompletos en categoría",
                    message: "Cada categoría debe incluir 'nombre'",
                    status: Status.badRequest,
                });
            }

            // Insert categoría
            const insCat = await executeQuery(
                dbConnection,
                `INSERT INTO variantes_categorias
           (did, did_variante, nombre, quien, superado, elim)
         VALUES (0, ?, ?, ?, 0, 0)`,
                [idVariante, nombreCat, userId],
                true
            );
            if (!insCat?.affectedRows) {
                throw new CustomException({
                    title: "Error al crear categoría",
                    message: "No se pudo insertar la categoría",
                    status: Status.internalServerError,
                });
            }
            const idCategoria = insCat.insertId;

            // set did = id
            await executeQuery(
                dbConnection,
                `UPDATE variantes_categorias SET did = ? WHERE id = ?`,
                [idCategoria, idCategoria],
                true
            );

            // valores
            const insertedVals = [];
            const valores = Array.isArray(cat?.valores) ? cat.valores : [];
            for (const v of valores) {
                const nombreVal = String(v?.nombre ?? "").trim();
                if (!isNonEmpty(nombreVal)) {
                    throw new CustomException({
                        title: "Datos incompletos en valores",
                        message: "Cada valor debe incluir 'nombre'",
                        status: Status.badRequest,
                    });
                }

                const insVal = await executeQuery(
                    dbConnection,
                    `INSERT INTO variantes_categoria_valores
             (did, did_categoria, nombre, quien, superado, elim)
           VALUES (0, ?, ?, ?, 0, 0)`,
                    [idCategoria, nombreVal, userId],
                    true
                );
                if (!insVal?.affectedRows) {
                    throw new CustomException({
                        title: "Error al crear valor",
                        message: "No se pudo insertar un valor de categoría",
                        status: Status.internalServerError,
                    });
                }
                const idVal = insVal.insertId;

                // set did = id
                await executeQuery(
                    dbConnection,
                    `UPDATE variantes_categoria_valores SET did = ? WHERE id = ?`,
                    [idVal, idVal],
                    true
                );

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
