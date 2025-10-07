// variantes.controller.js (ESM)
import {
    executeQuery,
    CustomException,
    Status,
    isNonEmpty,
    isDefined,
    number01,
} from "lightdata-tools";

/**
 * PUT /api/variantes/:varianteId
 * Body:
 *   root fields opcionales: { codigo?, nombre?, descripcion?, habilitado?(0/1), orden? }
 *   categorias: { add[], update[], remove[] }
 *     - add:    { nombre }
 *     - update: { did, nombre? }
 *     - remove: [ did | { did } ]
 *   valores: { add[], update[], remove[] }
 *     - add:    { did_categoria, nombre }
 *     - update: { did, nombre? }
 *     - remove: [ did | { did } ]
 *
 * Estrategia: versionado por did (superado=1 + insert con mismo did).
 * remove = supera + inserta nueva versión con elim=1.
 * Sin transacciones.
 */
export async function editVariante(db, req) {
    const { varianteId } = req.params;
    const userId = Number(req?.user?.userId ?? req?.user?.id ?? 0) || null;
    const body = req.body || {};

    const arr = (x) => (Array.isArray(x) ? x : []);
    const normRemove = (list) =>
        arr(list)
            .map((x) => (typeof x === "object" ? Number(x?.did ?? 0) : Number(x)))
            .filter((n) => Number.isFinite(n) && n > 0);

    const cAdd = arr(body?.categorias?.add);
    const cUpd = arr(body?.categorias?.update);
    const cDel = normRemove(body?.categorias?.remove);

    const vAdd = arr(body?.valores?.add);
    const vUpd = arr(body?.valores?.update);
    const vDel = normRemove(body?.valores?.remove);

    const changed = {
        variante: 0,
        categorias: { added: 0, updated: 0, removed: 0 },
        valores: { added: 0, updated: 0, removed: 0 },
    };

    // ---------- 1) Traer vigente de la variante ----------
    const vigenteRows = await executeQuery(
        db,
        `SELECT did, codigo, nombre, descripcion, habilitado, orden
       FROM variantes
      WHERE did = ? AND superado = 0 AND elim = 0
      LIMIT 1`,
        [varianteId]
    );
    const vigente = vigenteRows?.[0] || null;
    if (!vigente) {
        throw new CustomException({
            title: "Variante no encontrada",
            message: `No existe variante vigente con did=${varianteId}`,
            status: Status.notFound,
        });
    }

    // ---------- 2) Root variante (patch + versionado) ----------
    const baseFields = ["codigo", "nombre", "descripcion", "habilitado", "orden"];
    const hayPatch = baseFields.some((k) => body[k] !== undefined);

    if (hayPatch) {
        // Validaciones y normalizaciones
        const nextCodigo = isNonEmpty(body.codigo) ? String(body.codigo).trim() : vigente.codigo;
        if (nextCodigo !== vigente.codigo) {
            const dup = await executeQuery(
                db,
                `SELECT did FROM variantes
          WHERE codigo = ? AND elim = 0 AND superado = 0 AND did <> ?
          LIMIT 1`,
                [nextCodigo, varianteId]
            );
            if (dup?.length) {
                throw new CustomException({
                    title: "Código duplicado",
                    message: `Ya existe una variante activa con código "${nextCodigo}"`,
                    status: Status.conflict,
                });
            }
        }

        const nextNombre = isNonEmpty(body.nombre) ? String(body.nombre).trim() : vigente.nombre;
        const nextDesc = isDefined(body.descripcion)
            ? isNonEmpty(body.descripcion)
                ? String(body.descripcion).trim()
                : null
            : vigente.descripcion;

        let nextHab = vigente.habilitado;
        if (isDefined(body.habilitado)) {
            const h = number01(body.habilitado);
            if (h !== 0 && h !== 1) {
                throw new CustomException({
                    title: "Valor inválido",
                    message: "habilitado debe ser 0 o 1",
                    status: Status.badRequest,
                });
            }
            nextHab = h;
        }
        const nextOrden = Number.isFinite(Number(body.orden)) ? Number(body.orden) : (vigente.orden ?? 0);

        // Superar + nueva versión
        const upd = await executeQuery(
            db,
            `UPDATE variantes
          SET superado = 1, quien = ?
        WHERE did = ? AND superado = 0 AND elim = 0`,
            [userId, varianteId]
        );
        if (!upd?.affectedRows) {
            throw new CustomException({
                title: "Error al versionar variante",
                message: "La variante ya no está vigente o fue modificada concurrentemente",
                status: Status.notFound,
            });
        }

        await executeQuery(
            db,
            `INSERT INTO variantes
         (did, codigo, nombre, descripcion, habilitado, orden, quien, superado, elim)
       VALUES (?,   ?,      ?,      ?,           ?,          ?,     ?,     0,        0)`,
            [Number(varianteId), nextCodigo, nextNombre, nextDesc, nextHab, nextOrden, userId],
            true
        );

        changed.variante = 1;
    }

    // ---------- 3) CATEGORÍAS ----------
    // add
    for (const c of cAdd) {
        const nombre = isNonEmpty(c?.nombre) ? String(c.nombre).trim() : null;
        if (!nombre) {
            throw new CustomException({
                title: "Datos incompletos en categoría",
                message: "categorias.add requiere 'nombre'",
                status: Status.badRequest,
            });
        }

        const ins = await executeQuery(
            db,
            `INSERT INTO variantes_categorias
         (did, did_variante, nombre, quien, superado, elim)
       VALUES (0, ?, ?, ?, 0, 0)`,
            [varianteId, nombre, userId],
            true
        );
        const newId = ins?.insertId || 0;
        if (newId) {
            await executeQuery(
                db,
                `UPDATE variantes_categorias SET did = ? WHERE id = ?`,
                [newId, newId],
                true
            );
        }
        changed.categorias.added++;
    }

    // update (versionado)
    for (const c of cUpd) {
        if (!c?.did) continue;

        const curRows = await executeQuery(
            db,
            `SELECT * FROM variantes_categorias
        WHERE did = ? AND did_variante = ? AND superado = 0 AND elim = 0
        LIMIT 1`,
            [c.did, varianteId]
        );
        const cur = curRows?.[0];
        if (!cur) continue;

        const nombre = isNonEmpty(c?.nombre) ? String(c.nombre).trim() : cur.nombre ?? null;

        await executeQuery(
            db,
            `UPDATE variantes_categorias
          SET superado = 1, quien = ?
        WHERE did_variante = ? AND did = ? AND superado = 0 AND elim = 0`,
            [userId, varianteId, c.did]
        );

        await executeQuery(
            db,
            `INSERT INTO variantes_categorias
         (did, did_variante, nombre, quien, superado, elim)
       VALUES (?,   ?,            ?,      ?,     0,        0)`,
            [Number(c.did), varianteId, nombre, userId],
            true
        );

        changed.categorias.updated++;
    }

    // remove (versionado: supera + inserta elim=1)
    for (const did of cDel) {
        const curRows = await executeQuery(
            db,
            `SELECT * FROM variantes_categorias
        WHERE did = ? AND did_variante = ? AND superado = 0 AND elim = 0
        LIMIT 1`,
            [did, varianteId]
        );
        const cur = curRows?.[0];
        if (!cur) continue;

        await executeQuery(
            db,
            `UPDATE variantes_categorias
          SET superado = 1, quien = ?
        WHERE did_variante = ? AND did = ? AND superado = 0 AND elim = 0`,
            [userId, varianteId, did]
        );

        await executeQuery(
            db,
            `INSERT INTO variantes_categorias
         (did, did_variante, nombre, quien, superado, elim)
       VALUES (?,   ?,            ?,      ?,     0,        1)`,
            [Number(did), varianteId, cur.nombre ?? null, userId],
            true
        );

        changed.categorias.removed++;
    }

    // ---------- 4) VALORES ----------
    // add
    for (const v of vAdd) {
        const didCategoria = Number(v?.did_categoria ?? 0);
        const nombre = isNonEmpty(v?.nombre) ? String(v.nombre).trim() : null;

        if (!Number.isFinite(didCategoria) || didCategoria <= 0) {
            throw new CustomException({
                title: "Datos inválidos en valor",
                message: "valores.add requiere 'did_categoria' numérico",
                status: Status.badRequest,
            });
        }
        if (!nombre) {
            throw new CustomException({
                title: "Datos inválidos en valor",
                message: "valores.add requiere 'nombre'",
                status: Status.badRequest,
            });
        }

        // (opcional) validar categoría vigente
        const catRows = await executeQuery(
            db,
            `SELECT did FROM variantes_categorias
        WHERE did = ? AND superado = 0 AND elim = 0
        LIMIT 1`,
            [didCategoria]
        );
        if (!catRows?.length) {
            throw new CustomException({
                title: "Categoría no encontrada",
                message: "La categoría no existe o no está vigente",
                status: Status.notFound,
            });
        }

        const ins = await executeQuery(
            db,
            `INSERT INTO variantes_categoria_valores
         (did, did_categoria, nombre, quien, superado, elim)
       VALUES (0,   ?,             ?,      ?,     0,        0)`,
            [didCategoria, nombre, userId],
            true
        );
        const newId = ins?.insertId || 0;
        if (newId) {
            await executeQuery(
                db,
                `UPDATE variantes_categoria_valores SET did = ? WHERE id = ?`,
                [newId, newId],
                true
            );
        }
        changed.valores.added++;
    }

    // update (versionado)
    for (const v of vUpd) {
        if (!v?.did) continue;

        const curRows = await executeQuery(
            db,
            `SELECT * FROM variantes_categoria_valores
        WHERE did = ? AND superado = 0 AND elim = 0
        LIMIT 1`,
            [v.did]
        );
        const cur = curRows?.[0];
        if (!cur) continue;

        const nombre = isNonEmpty(v?.nombre) ? String(v.nombre).trim() : cur.nombre ?? null;

        await executeQuery(
            db,
            `UPDATE variantes_categoria_valores
          SET superado = 1, quien = ?
        WHERE did = ? AND superado = 0 AND elim = 0`,
            [userId, v.did]
        );

        await executeQuery(
            db,
            `INSERT INTO variantes_categoria_valores
         (did, did_categoria, nombre, quien, superado, elim)
       VALUES (?,   ?,             ?,      ?,     0,        0)`,
            [Number(v.did), cur.did_categoria, nombre, userId],
            true
        );

        changed.valores.updated++;
    }

    // remove (versionado: supera + inserta elim=1)
    for (const did of vDel) {
        const curRows = await executeQuery(
            db,
            `SELECT * FROM variantes_categoria_valores
        WHERE did = ? AND superado = 0 AND elim = 0
        LIMIT 1`,
            [did]
        );
        const cur = curRows?.[0];
        if (!cur) continue;

        await executeQuery(
            db,
            `UPDATE variantes_categoria_valores
          SET superado = 1, quien = ?
        WHERE did = ? AND superado = 0 AND elim = 0`,
            [userId, did]
        );
        await executeQuery(
            db,
            `INSERT INTO variantes_categoria_valores
         (did, did_categoria, nombre, quien, superado, elim)
       VALUES (?,   ?,             ?,      ?,     0,        1)`,
            [Number(did), cur.did_categoria, cur.nombre ?? null, userId],
            true
        );

        changed.valores.removed++;
    }

    return {
        success: true,
        message: "Variante actualizada correctamente (versionado)",
        data: { did: Number(varianteId) },
        meta: { changed, timestamp: new Date().toISOString() },
    };
}
