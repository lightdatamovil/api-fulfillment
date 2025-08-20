import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Edita un atributo existente (versionado por did).
 * Body soportado: { codigo?, nombre?, descripcion?, habilitado? (0/1), orden?, atributoValores?: [{ valor, codigo?, habilitado? (0/1) }, ...] }
 * Param: atributoId (did del atributo)
 */
export async function editAtributo(dbConnection, req) {
    const { atributoId } = req.params;
    const { userId } = req.user ?? {};
    const { codigo, nombre, descripcion, habilitado, orden, atributoValores } = req.body ?? {};

    // 1) Verificar existencia atributo actual
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

    // 2) Validar duplicado de código si se modifica
    let newCodigo = isNonEmpty(codigo) ? String(codigo).trim() : current.codigo;
    if (newCodigo !== current.codigo) {
        const qDup = `
      SELECT did
      FROM atributos
      WHERE codigo = ? AND elim = 0 AND superado = 0 AND did <> ?
      LIMIT 1
    `;
        const dup = await executeQuery(dbConnection, qDup, [newCodigo, atributoId]);
        if (dup && dup.length > 0) {
            throw new CustomException({
                title: "Código duplicado",
                message: `Ya existe un atributo activo con código "${newCodigo}"`,
                status: Status.conflict,
            });
        }
    }

    // 3) Preparar nuevos valores
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
    const newOrden = Number.isFinite(Number(orden)) ? Number(orden) : current.orden ?? 0;

    // 4) Versionar atributo: supero actual e inserto nueva versión con mismo did
    await executeQuery(
        dbConnection,
        `UPDATE atributos SET superado = 1 WHERE did = ? AND elim = 0 AND superado = 0`,
        [atributoId]
    );

    const insAttrSql = `
    INSERT INTO atributos (did, codigo, nombre, descripcion, habilitado, orden, quien, superado, elim)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
  `;
    const insAttr = await executeQuery(
        dbConnection,
        insAttrSql,
        [atributoId, newCodigo, newNombre, newDesc, newHab, newOrden, userId]
    );

    if (!insAttr || insAttr.affectedRows === 0) {
        throw new CustomException({
            title: "Error al versionar atributo",
            message: "No se pudo crear la nueva versión del atributo",
            status: Status.internalServerError,
        });
    }

    // 5) (Opcional) Versionar valores si vienen en el body
    const insertedValores = [];
    if (Array.isArray(atributoValores)) {
        // supero valores actuales del atributo
        await executeQuery(
            dbConnection,
            `UPDATE atributos_valores SET superado = 1
       WHERE didAtributo = ? AND elim = 0 AND superado = 0`,
            [atributoId]
        );

        for (const v of atributoValores) {
            const valValor = isNonEmpty(v?.valor) ? String(v.valor).trim() : null;
            const valCodigo = isNonEmpty(v?.codigo) ? String(v.codigo).trim() : null;

            if (!valValor) {
                throw new CustomException({
                    title: "Datos incompletos en atributoValores",
                    message: "Cada item debe incluir 'valor'",
                    status: Status.badRequest,
                });
            }

            let valHab = 1;
            if (isDefined(v?.habilitado)) {
                const h = number01(v.habilitado);
                if (h !== 0 && h !== 1) {
                    throw new CustomException({
                        title: "Valor inválido en atributoValores",
                        message: "habilitado debe ser 0 o 1",
                        status: Status.badRequest,
                    });
                }
                valHab = h;
            }

            const insValSql = `
        INSERT INTO atributos_valores (didAtributo, valor, codigo, habilitado, quien, superado, elim)
        VALUES (?, ?, ?, ?, ?, 0, 0)
      `;
            const insVal = await executeQuery(
                dbConnection,
                insValSql,
                [atributoId, valValor, valCodigo, valHab, userId]
            );

            if (!insVal || insVal.affectedRows === 0) {
                throw new CustomException({
                    title: "Error al versionar valores",
                    message: "No se pudo insertar un valor de atributo",
                    status: Status.internalServerError,
                });
            }

            const idVal = insVal.insertId;
            await executeQuery(
                dbConnection,
                `UPDATE atributos_valores SET did = ? WHERE id = ?`,
                [idVal, idVal]
            );

            insertedValores.push({
                id: idVal,
                did: idVal,
                didAtributo: Number(atributoId),
                valor: valValor,
                codigo: valCodigo,
                habilitado: valHab,
            });
        }
    }

    return {
        success: true,
        message: "Atributo actualizado correctamente",
        data: {
            did: Number(atributoId),
            valores: insertedValores.length ? insertedValores : undefined
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
