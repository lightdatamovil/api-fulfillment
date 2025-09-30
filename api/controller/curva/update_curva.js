// controller/variantes/update_curva.js
import { CustomException, executeQuery, Status, isNonEmpty } from "lightdata-tools";

/**
 * Versionado de curva (PUT):
 * - Supera la versión vigente de variantes_curvas para el did dado.
 * - Inserta nueva versión con el mismo did (id cambia).
 * - Si viene "categorias" (number[]), supera los links vigentes y re-inserta los nuevos.
 *   Si no viene, no toca links.
 *
 * Body:
 *   did: number (requerido)
 *   nombre?: string
 *   categorias?: number[]   // opcional
 */
export async function updateCurva(dbConnection, req) {
    const { did, nombre, categorias } = req.body;
    const { userId } = req.user;

    const didCurva = Number(did);
    if (!Number.isFinite(didCurva) || didCurva <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "Se requiere 'did' numérico válido",
            status: Status.badRequest,
        });
    }

    // Traer la versión vigente actual (elim=0, superado=0)
    const currRows = await executeQuery(
        dbConnection,
        `
      SELECT id, did, nombre
      FROM variantes_curvas
      WHERE did = ? AND elim = 0 AND superado = 0
      ORDER BY id DESC
      LIMIT 1
    `,
        [didCurva]
    );

    if (!currRows || currRows.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No existe una curva vigente con did ${didCurva}`,
            status: Status.notFound,
        });
    }

    const curr = currRows[0];
    const newNombre = isNonEmpty(nombre) ? String(nombre).trim() : curr.nombre;

    // 1) Superar versión vigente
    await executeQuery(
        dbConnection,
        `
      UPDATE variantes_curvas
      SET superado = 1
      WHERE did = ? AND elim = 0 AND superado = 0
    `,
        [didCurva],
        true
    );

    // 2) Insertar nueva versión (con did igual al original)
    const ins = await executeQuery(
        dbConnection,
        `
      INSERT INTO variantes_curvas (nombre, quien, superado, elim)
      VALUES (?, ?, 0, 0)
    `,
        [newNombre, userId],
        true
    );

    if (!ins || ins.affectedRows === 0) {
        throw new CustomException({
            title: "Error al versionar curva",
            message: "No se pudo insertar la nueva versión de la curva",
            status: Status.internalServerError,
        });
    }

    const newId = ins.insertId;

    // Setear el did de la nueva fila al did original
    await executeQuery(
        dbConnection,
        `UPDATE variantes_curvas SET did = ? WHERE id = ?`,
        [didCurva, newId],
        true
    );

    // 3) Links (solo si viene "categorias")
    let linked;
    if (Array.isArray(categorias)) {
        const validIds = categorias
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        // Validar existencia de categorías activas
        if (validIds.length > 0) {
            const placeholders = validIds.map(() => "?").join(", ");
            const check = await executeQuery(
                dbConnection,
                `
          SELECT did
          FROM variantes_categorias
          WHERE elim = 0 AND superado = 0 AND did IN (${placeholders})
        `,
                validIds
            );
            const okSet = new Set((check || []).map((r) => Number(r.did)));
            const missing = validIds.filter((d) => !okSet.has(d));
            if (missing.length > 0) {
                throw new CustomException({
                    title: "Categorías no encontradas",
                    message: `No existen/activas las siguientes categorías: [${missing.join(", ")}]`,
                    status: Status.badRequest,
                });
            }
        }

        // 3.a) Superar links vigentes de esa curva
        await executeQuery(
            dbConnection,
            `
        UPDATE variantes_categorias_curvas
        SET superado = 1
        WHERE did_curva = ? AND elim = 0 AND superado = 0
      `,
            [didCurva],
            true
        );

        // 3.b) Insertar nuevos links (misma curva, superado=0, elim=0)
        linked = 0;
        for (const didCategoria of validIds) {
            const insLink = await executeQuery(
                dbConnection,
                `
          INSERT INTO variantes_categorias_curvas (did_curva, did_categoria, quien, superado, elim)
          VALUES (?, ?, ?, 0, 0)
        `,
                [didCurva, didCategoria, userId],
                true
            );
            if (insLink && insLink.affectedRows > 0) linked += 1;
        }
    }

    return {
        success: true,
        message: "Curva versionada correctamente",
        data: {
            did: didCurva,
            idVersionNueva: newId,
            nombre: newNombre,
            ...(linked !== undefined ? { categoriasVinculadas: linked } : {}),
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
