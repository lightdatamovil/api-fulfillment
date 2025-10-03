import { CustomException, executeQuery, Status, isNonEmpty, isDefined, number01 } from "lightdata-tools";

/**
 * Versiona el insumo (supera la fila activa e inserta una nueva)
 * y aplica cambios incrementales en asociaciones:
 *   - clientes_add?: number[]
 *   - clientes_remove?: number[]
 *
 * req.params.insumoId = did del insumo
 * req.body: { codigo?, nombre?, unidad?, habilitado?, clientes_add?, clientes_remove? }
 */
export async function editInsumo(dbConnection, req) {
    const { codigo, nombre, unidad, habilitado, clientes_dids_add, clientes_dids_remove } = req.body;
    const { userId } = req.user;
    const { insumoId } = req.params;

    const norm = (v) =>
        Array.isArray(v) ? [...new Set(v.map(n => Number(n)).filter(Number.isFinite))] : [];

    // 1) Verificar existencia (por did, activo)
    const qGet = `
    SELECT id, did, codigo, nombre, habilitado, unidad
    FROM insumos
    WHERE did = ? AND elim = 0 AND superado = 0
    LIMIT 1
  `;
    const rows = await executeQuery(dbConnection, qGet, [insumoId]);
    if (!rows?.length) {
        throw new CustomException({
            title: "Insumo no encontrado",
            message: `No existe insumo activo con did=${insumoId}`,
            status: Status.notFound,
        });
    }
    const current = rows[0];

    // 1.a) Validar código duplicado
    if (isNonEmpty(codigo)) {
        const dup = await executeQuery(
            dbConnection,
            `SELECT did FROM insumos
       WHERE codigo = ? AND elim = 0 AND superado = 0 AND did <> ?
       LIMIT 1`,
            [codigo, insumoId]
        );
        if (dup?.length) {
            throw new CustomException({
                title: "Código duplicado",
                message: `Ya existe un insumo activo con código "${codigo}"`,
                status: Status.conflict,
            });
        }
    }

    // 2) Nuevos valores (fallback)
    const newCodigo = isNonEmpty(codigo) ? String(codigo).trim() : current.codigo;
    const newNombre = isNonEmpty(nombre) ? String(nombre).trim() : current.nombre;
    const newUnidad = isDefined(unidad) ? Number(unidad) || 0 : current.unidad;

    let newHabilitado = current.habilitado;
    if (isDefined(habilitado)) {
        const hab = number01(habilitado);
        if (hab !== 0 && hab !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "habilitado debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        newHabilitado = hab;
    }

    // 3) Superar versión actual
    await executeQuery(
        dbConnection,
        `UPDATE insumos
     SET superado = 1
     WHERE did = ? AND elim = 0 AND superado = 0`,
        [insumoId]
    );

    // 4) Insertar nueva versión
    const ins = await executeQuery(
        dbConnection,
        `INSERT INTO insumos (did, codigo, nombre, unidad, habilitado, quien, superado)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [insumoId, newCodigo, newNombre, newUnidad, newHabilitado, userId]
    );
    if (!ins?.affectedRows) {
        throw new CustomException({
            title: "Error al versionar insumo",
            message: "No se pudo crear la nueva versión del insumo",
            status: Status.internalServerError,
        });
    }

    // 5) Asociaciones incrementales
    const toAdd = norm(clientes_dids_add);
    const toRemove = norm(clientes_dids_remove);

    // 5.a) Remover -> marcar superado=1 (no borrar)
    if (toRemove.length > 0) {
        const sql = `
      UPDATE insumos_clientes
      SET superado = 1
      WHERE did_insumo = ?
        AND did_cliente IN (${toRemove.map(() => "?").join(",")})
        AND superado = 0
        AND elim = 0
    `;
        await executeQuery(dbConnection, sql, [insumoId, ...toRemove]);
    }

    // 5.b) Agregar -> reactivar si existe "dormido", sino insertar
    if (toAdd.length > 0) {
        // Reactivar existentes (superado=1 o elim=1)
        const sqlReact = `
      UPDATE insumos_clientes
      SET superado = 0, elim = 0, quien = ?
      WHERE did_insumo = ?
        AND did_cliente IN (${toAdd.map(() => "?").join(",")})
        AND (superado = 1 OR elim = 1)
    `;
        await executeQuery(dbConnection, sqlReact, [userId, insumoId, ...toAdd]);

        // Insertar los que aún no existen (ningún registro para ese par)
        // (NOT EXISTS evita duplicados; si además tienes UNIQUE(did_insumo, did_cliente), mejor)
        const insertOne = `
      INSERT INTO insumos_clientes (did_insumo, did_cliente, quien, superado, elim)
      SELECT ?, ?, ?, 0, 0
      WHERE NOT EXISTS (
        SELECT 1 FROM insumos_clientes
        WHERE did_insumo = ? AND did_cliente = ?
      )
    `;
        for (const cid of toAdd) {
            await executeQuery(dbConnection, insertOne, [insumoId, cid, userId, insumoId, cid]);
        }
    }

    // 6) Devolver asociaciones activas
    const activos = await executeQuery(
        dbConnection,
        `SELECT did_cliente
     FROM insumos_clientes
     WHERE did_insumo = ? AND superado = 0 AND elim = 0
     ORDER BY did_cliente ASC`,
        [insumoId]
    );

    return {
        success: true,
        message: "Insumo actualizado correctamente",
        data: {
            did: Number(insumoId),
            clientes_ids: activos.map(r => r.did_cliente),
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
