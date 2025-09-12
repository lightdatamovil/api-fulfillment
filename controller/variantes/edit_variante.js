import { CustomException, executeQuery, Status, isNonEmpty, isDefined, number01 } from "lightdata-tools";

/**
 * Edita una variante existente (versionado por did) y procesa 'data' con acciones sobre variantes_valores.
 * Body:
 * {
 *   codigo?, nombre?, descripcion?, habilitado?(0/1), orden?,
 *   data?: [
 *     { action: "create", valor, codigo?, habilitado?(0/1), didProducto?, varianteId? },
 *     { action: "delete", varianteValorId } // varianteValorId = did del valor
 *   ]
 * }
 * Param: varianteId (did de la variante)
 */
export async function editVariante(dbConnection, req) {
    const { varianteId } = req.params;
    const { userId } = req.user ?? {};
    const { codigo, nombre, descripcion, habilitado, orden, data } = req.body ?? {};

    // 1) Verificar existencia
    const qGet = `
    SELECT did, codigo, nombre, descripcion, habilitado, orden
    FROM atributos
    WHERE did = ? AND elim = 0 AND superado = 0
    LIMIT 1
  `;
    const rows = await executeQuery(dbConnection, qGet, [varianteId]);
    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "Variante no encontrada",
            message: `No existe variante con did=${varianteId}`,
            status: Status.notFound,
        });
    }
    const current = rows[0];

    // 2) Duplicado de código si cambia
    const newCodigo = isNonEmpty(codigo) ? String(codigo).trim() : current.codigo;
    if (newCodigo !== current.codigo) {
        const qDup = `
      SELECT did
      FROM atributos
      WHERE codigo = ? AND elim = 0 AND superado = 0 AND did <> ?
      LIMIT 1
    `;
        const dup = await executeQuery(dbConnection, qDup, [newCodigo, varianteId]);
        if (dup?.length) {
            throw new CustomException({
                title: "Código duplicado",
                message: `Ya existe una variante activa con código "${newCodigo}"`,
                status: Status.conflict,
            });
        }
    }

    // 3) Nuevos valores de la variante
    const newNombre = isNonEmpty(nombre) ? String(nombre).trim() : current.nombre;
    const newDesc = isDefined(descripcion) ? (isNonEmpty(descripcion) ? String(descripcion).trim() : null) : current.descripcion;

    let newHab = current.habilitado;
    if (isDefined(habilitado)) {
        const h = number01(habilitado);
        if (h !== 0 && h !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "habilitado debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        newHab = h;
    }
    const newOrden = Number.isFinite(Number(orden)) ? Number(orden) : (current.orden ?? 0);

    // 4) Versionar variante (supero actual + nueva versión)
    await executeQuery(
        dbConnection,
        `UPDATE atributos SET superado = 1 WHERE did = ? AND elim = 0 AND superado = 0`,
        [varianteId]
    );

    const insAttr = await executeQuery(
        dbConnection,
        `
      INSERT INTO atributos (did, codigo, nombre, descripcion, habilitado, orden, quien, superado, elim)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
    `,
        [varianteId, newCodigo, newNombre, newDesc, newHab, newOrden, userId]
    );

    if (!insAttr || insAttr.affectedRows === 0) {
        throw new CustomException({
            title: "Error al versionar variante",
            message: "No se pudo crear la nueva versión de la variante",
            status: Status.internalServerError,
        });
    }

    // 5) Acciones sueltas en 'data'
    const created = [];
    const deleted = [];

    if (Array.isArray(data)) {
        for (const item of data) {
            const action = String(item?.action || "").toLowerCase();

            if (action === "create") {
                const didVar = Number(item?.atributoId ?? varianteId) || Number(varianteId);
                const valValor = isNonEmpty(item?.valor) ? String(item.valor).trim() : null;
                if (!valValor) {
                    throw new CustomException({
                        title: "Dato inválido",
                        message: "data.create requiere 'valor'",
                        status: Status.badRequest,
                    });
                }
                const valCodigo = isNonEmpty(item?.codigo) ? String(item.codigo).trim() : null;

                let valHab = 1;
                if (isDefined(item?.habilitado)) {
                    const h = number01(item.habilitado);
                    if (h !== 0 && h !== 1) {
                        throw new CustomException({
                            title: "Dato inválido",
                            message: "habilitado en data.create debe ser 0 o 1",
                            status: Status.badRequest,
                        });
                    }
                    valHab = h;
                }

                const didProducto = Number(item?.didProducto ?? 0) || 0;

                const ins = await executeQuery(
                    dbConnection,
                    `
            INSERT INTO atributos_valores
              (didProducto, didAtributo, valor, codigo, habilitado, quien, superado, elim)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0)
          `,
                    [didProducto, didVar, valValor, valCodigo, valHab, userId],
                    true
                );

                if (!ins || ins.affectedRows === 0) {
                    throw new CustomException({
                        title: "Error al crear valor",
                        message: "No se pudo insertar un valor (data.create)",
                        status: Status.internalServerError,
                    });
                }

                const id = ins.insertId;
                await executeQuery(dbConnection, `UPDATE atributos_valores SET did = ? WHERE id = ?`, [id, id], true);

                created.push({
                    id, did: id, didVar, didProducto, valor: valValor, codigo: valCodigo, habilitado: valHab
                });
            }

            else if (action === "delete") {
                const didVal = Number(item?.atributoValorId);
                if (!Number.isFinite(didVal) || didVal <= 0) {
                    throw new CustomException({
                        title: "Dato inválido",
                        message: "varianteValorId inválido en data.delete",
                        status: Status.badRequest,
                    });
                }
                const del = await executeQuery(
                    dbConnection,
                    `UPDATE atributos_valores SET elim = 1 WHERE did = ? AND elim = 0`,
                    [didVal],
                    true
                );
                deleted.push({ did: didVal, affectedRows: del?.affectedRows ?? 0 });
            }

            else {
                throw new CustomException({
                    title: "Acción inválida",
                    message: `action debe ser "create" o "delete"`,
                    status: Status.badRequest,
                });
            }
        }
    }

    return {
        success: true,
        message: "Variante actualizada correctamente",
        data: {
            did: Number(varianteId),
            created: created.length ? created : undefined,
            deleted: deleted.length ? deleted : undefined
        },
        meta: { timestamp: new Date().toISOString() },
    };
}