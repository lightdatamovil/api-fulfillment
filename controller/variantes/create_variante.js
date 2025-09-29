import { CustomException, executeQuery, Status, isNonEmpty, isDefined, number01 } from "lightdata-tools";

/**
 * Crea una categoría de variantes y (opcional) sus subcategorías y valores.
 * Requiere: codigo, nombre.
 * Opcionales: descripcion, habilitado (0/1), orden, subcategorias[][]. 
 *   - subcategorias: array de objetos { valores: [{ nombre }] }
 * Notas:
 *   - Sin transacciones (mismo criterio que tu flujo actual).
 *   - did == id (se actualiza post-insert).
 *   - Unicidad de 'codigo' en variantes_categorias con elim=0 y superado=0.
 */
export async function createVarianteCategoria(dbConnection, req) {
    const { codigo, nombre, descripcion, habilitado, orden, subcategorias } = req.body;
    const { userId } = req.user;

    // ---------- Normalizaciones ----------
    const codigoTrim = String(codigo ?? "").trim();
    const nombreTrim = String(nombre ?? "").trim();
    const descTrim = isNonEmpty(descripcion) ? String(descripcion).trim() : null;

    if (!isNonEmpty(codigoTrim) || !isNonEmpty(nombreTrim)) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Se requieren 'codigo' y 'nombre' para crear la categoría de variantes",
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

    // ---------- Duplicados de 'codigo' en variantes_categorias ----------
    const qDup = `
    SELECT did
    FROM variantes_categorias
    WHERE codigo = ? AND elim = 0 AND superado = 0
    LIMIT 1
  `;
    const dup = await executeQuery(dbConnection, qDup, [codigoTrim]);
    if (dup && dup.length > 0) {
        throw new CustomException({
            title: "Código duplicado",
            message: `Ya existe una categoría activa con código "${codigoTrim}"`,
            status: Status.conflict,
        });
    }

    // ---------- Insert categoría ----------
    const insertCatSql = `
    INSERT INTO variantes_categorias 
      (codigo, nombre, descripcion, habilitado, orden, quien, superado, elim)
    VALUES 
      (?, ?, ?, ?, ?, ?, 0, 0)
  `;
    const insCat = await executeQuery(
        dbConnection,
        insertCatSql,
        [codigoTrim, nombreTrim, descTrim, habValue, ordenValue, userId],
        true
    );

    if (!insCat || insCat.affectedRows === 0) {
        throw new CustomException({
            title: "Error al crear categoría",
            message: "No se pudo insertar la categoría de variantes",
            status: Status.internalServerError,
        });
    }

    const idCategoria = insCat.insertId;
    await executeQuery(
        dbConnection,
        `UPDATE variantes_categorias SET did = ? WHERE id = ?`,
        [idCategoria, idCategoria],
        true
    );
    const didCategoria = idCategoria;

    // ---------- Subcategorías y valores (opcionales) ----------
    const insertedSubcats = [];

    if (Array.isArray(subcategorias) && subcategorias.length > 0) {
        for (const sub of subcategorias) {
            // Insert subcategoría (sin 'nombre' según tu esquema)
            const insSubSql = `
        INSERT INTO variantes_subcategorias (did_categoria, quien, superado, elim)
        VALUES (?, ?, 0, 0)
      `;
            const insSub = await executeQuery(
                dbConnection,
                insSubSql,
                [didCategoria, userId],
                true
            );

            if (!insSub || insSub.affectedRows === 0) {
                throw new CustomException({
                    title: "Error al crear subcategoría",
                    message: "No se pudo insertar una subcategoría",
                    status: Status.internalServerError,
                });
            }

            const idSub = insSub.insertId;
            await executeQuery(
                dbConnection,
                `UPDATE variantes_subcategorias SET did = ? WHERE id = ?`,
                [idSub, idSub],
                true
            );
            const didSubcategoria = idSub;

            const insertedVals = [];

            if (Array.isArray(sub?.valores) && sub.valores.length > 0) {
                for (const v of sub.valores) {
                    const nombreVal = isNonEmpty(v?.nombre) ? String(v.nombre).trim() : null;

                    if (!isNonEmpty(nombreVal)) {
                        throw new CustomException({
                            title: "Datos incompletos en valores",
                            message: "Cada valor debe incluir 'nombre'",
                            status: Status.badRequest,
                        });
                    }

                    const insValSql = `
            INSERT INTO variantes_subcategoria_valores (did_subcategoria, nombre, quien, superado, elim)
            VALUES (?, ?, ?, 0, 0)
          `;
                    const insVal = await executeQuery(
                        dbConnection,
                        insValSql,
                        [didSubcategoria, nombreVal, userId],
                        true
                    );

                    if (!insVal || insVal.affectedRows === 0) {
                        throw new CustomException({
                            title: "Error al crear valor",
                            message: "No se pudo insertar un valor de subcategoría",
                            status: Status.internalServerError,
                        });
                    }

                    const idVal = insVal.insertId;

                    await executeQuery(
                        dbConnection,
                        `UPDATE variantes_subcategoria_valores SET did = ? WHERE id = ?`,
                        [idVal, idVal],
                        true
                    );

                    insertedVals.push({
                        id: idVal,
                        did: idVal,
                        didSubcategoria: didSubcategoria,
                        nombre: nombreVal,
                    });
                }
            }

            insertedSubcats.push({
                id: idSub,
                did: idSub,
                didCategoria: didCategoria,
                valores: insertedVals,
            });
        }
    }

    return {
        success: true,
        message: "Categoría de variantes creada correctamente",
        data: {
            categoria: {
                id: idCategoria,
                did: didCategoria,
                codigo: codigoTrim,
                nombre: nombreTrim,
                descripcion: descTrim,
                habilitado: habValue,
                orden: ordenValue,
            },
            subcategorias: insertedSubcats,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
