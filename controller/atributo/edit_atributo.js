import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Edita un atributo existente (versionado por did) y procesa 'data' con acciones sobre atributos_valores.
 * Body:
 * {
 *   codigo?, nombre?, descripcion?, habilitado?(0/1), orden?,
 *   data?: [
 *     { action: "create", valor, codigo?, habilitado?(0/1), didProducto?, atributoId? },
 *     { action: "delete", atributoValorId } // atributoValorId = did del valor
 *   ]
 * }
 * Param: atributoId (did del atributo)
 */
export async function editAtributo(dbConnection, req) {
    const { atributoId } = req.params;
    const { userId } = req.user ?? {};
    const { codigo, nombre, descripcion, habilitado, orden, data } = req.body ?? {};

    // 1) Verificar existencia
    const qGet = `
    SELECT did, codigo, nombre, descripcion, habilitado, orden
    FROM atributos
    WHERE did = ? AND elim = 0 AND superado = 0
    LIMIT 1
  `;
    const rows = await executeQuery(dbConnection, qGet, [atributoId]);
    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "Atributo no encontrado",
            message: `No existe atributo con did=${atributoId}`,
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
        const dup = await executeQuery(dbConnection, qDup, [newCodigo, atributoId]);
        if (dup?.length) {
            throw new CustomException({
                title: "Código duplicado",
                message: `Ya existe un atributo activo con código "${newCodigo}"`,
                status: Status.conflict,
            });
        }
    }

    // 3) Nuevos valores del atributo
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

    // 4) Versionar atributo (supero actual + nueva versión)
    await executeQuery(
        dbConnection,
        `UPDATE atributos SET superado = 1 WHERE did = ? AND elim = 0 AND superado = 0`,
        [atributoId]
    );

    const insAttr = await executeQuery(
        dbConnection,
        `
      INSERT INTO atributos (did, codigo, nombre, descripcion, habilitado, orden, quien, superado, elim)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
    `,
        [atributoId, newCodigo, newNombre, newDesc, newHab, newOrden, userId]
    );

    if (!insAttr || insAttr.affectedRows === 0) {
        throw new CustomException({
            title: "Error al versionar atributo",
            message: "No se pudo crear la nueva versión del atributo",
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
                const didAttr = Number(item?.atributoId ?? atributoId) || Number(atributoId);
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
                    [didProducto, didAttr, valValor, valCodigo, valHab, userId],
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
                    id, did: id, didAtributo: didAttr, didProducto, valor: valValor, codigo: valCodigo, habilitado: valHab
                });
            }

            else if (action === "delete") {
                const didVal = Number(item?.atributoValorId);
                if (!Number.isFinite(didVal) || didVal <= 0) {
                    throw new CustomException({
                        title: "Dato inválido",
                        message: "atributoValorId inválido en data.delete",
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
        message: "Atributo actualizado correctamente",
        data: {
            did: Number(atributoId),
            created: created.length ? created : undefined,
            deleted: deleted.length ? deleted : undefined
        },
        meta: { timestamp: new Date().toISOString() },
    };
}

/* ---------------- Helpers ---------------- */
const isDefined = (v) => v !== undefined && v !== null;
const isNonEmpty = (v) => isDefined(v) && (typeof v !== "string" || v.trim() !== "");
const number01 = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) return -1;
    return n === 1 ? 1 : n === 0 ? 0 : -1;
};
