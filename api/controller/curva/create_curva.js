import { CustomException, executeQuery, Status, isNonEmpty } from "lightdata-tools";


/**
 * Crea una curva y, opcionalmente, asocia categorías a la curva.
 * Body esperado:
 * {
 *   nombre: string (requerido),
 *   categorias: number[] (opcional) // array de did_categoria
 * }
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
    const insSql = `
    INSERT INTO curvas (nombre, quien, superado, elim)
    VALUES (?, ?, 0, 0)
  `;
    const ins = await executeQuery(dbConnection, insSql, [nombreTrim, userId]);

    if (!ins || ins.affectedRows === 0) {
        throw new CustomException({
            title: "Error al crear curva",
            message: "No se pudo insertar la curva",
            status: Status.internalServerError,
        });
    }

    const id = ins.insertId;
    await executeQuery(
        dbConnection,
        `UPDATE curvas SET did = ? WHERE id = ?`,
        [id, id],
        true
    );

    const didCurva = id;

    // Asociaciones opcionales con categorías
    let linked = 0;
    if (Array.isArray(variantes) && variantes.length > 0) {
        // Validar que existan esas categorías activas
        const validIds = variantes
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        if (validIds.length !== variantes.length) {
            throw new CustomException({
                title: "Categorías inválidas",
                message: "Todas las categorías deben ser números válidos",
                status: Status.badRequest,
            });
        }

        // Validar existencia en variantes_categorias (activas)
        const placeholders = validIds.map(() => "?").join(", ");
        const qCheck = `
      SELECT did
      FROM variantes
      WHERE elim = 0 AND superado = 0 AND did IN (${placeholders})
    `;
        const found = await executeQuery(dbConnection, qCheck, validIds);

        const foundSet = new Set((found || []).map((r) => Number(r.did)));
        const missing = validIds.filter((d) => !foundSet.has(d));
        if (missing.length > 0) {
            throw new CustomException({
                title: "Categorías no encontradas",
                message: `No existen/activas las siguientes categorías: [${missing.join(", ")}]`,
                status: Status.badRequest,
            });
        }

        // Insertar links (si ya existiera el par y estuviera elim=1, lo reactivamos)
        for (const didVariante of validIds) {
            // Intentar reactivar
            const upd = await executeQuery(
                dbConnection,
                `
          UPDATE variantes_curvas
          SET elim = 0, superado = 0, quien = ?
          WHERE did_curva = ? AND did_categoria = ?
        `,
                [userId, didCurva, didVariante],
                true
            );

            if (!upd || upd.affectedRows === 0) {
                // Si no existía, insertamos
                const insLink = await executeQuery(
                    dbConnection,
                    `
            INSERT INTO variantes_curvas (did_curva, did_variante, quien, superado, elim)
            VALUES (?, ?, ?, 0, 0)
          `,
                    [didCurva, didVariante, userId],
                    true
                );
                if (insLink && insLink.affectedRows > 0) linked += 1;
            } else {
                linked += 1;
            }
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
