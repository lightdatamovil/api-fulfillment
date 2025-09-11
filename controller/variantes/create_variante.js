import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Crea una variante y (opcional) sus valores sin transacciones/rollback.
 * Requiere: codigo, nombre.
 * Opcionales: descripcion, habilitado (0/1), orden, varianteValores[]
 */
export async function createVariante(dbConnection, req) {
    const { codigo, nombre, descripcion, habilitado, orden, varianteValores } = req.body;
    const { userId } = req.user;

    const codigoTrim = String(codigo).trim();
    const nombreTrim = String(nombre).trim();
    const descTrim = isNonEmpty(descripcion) ? String(descripcion).trim() : null;

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

    const qDup = `
    SELECT did
    FROM atributos
    WHERE codigo = ? AND elim = 0 AND superado = 0
    LIMIT 1
  `;
    const dup = await executeQuery(dbConnection, qDup, [codigoTrim]);
    if (dup && dup.length > 0) {
        throw new CustomException({
            title: "Código duplicado",
            message: `Ya existe un atributo activo con código "${codigoTrim}"`,
            status: Status.conflict,
        });
    }

    const insertSql = `
    INSERT INTO atributos (codigo, nombre, descripcion, habilitado, orden, quien, superado, elim)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0)
  `;
    const ins = await executeQuery(
        dbConnection,
        insertSql,
        [codigoTrim, nombreTrim, descTrim, habValue, ordenValue, userId],
        true
    );

    if (!ins || ins.affectedRows === 0) {
        throw new CustomException({
            title: "Error al crear atributo",
            message: "No se pudo insertar el atributo",
            status: Status.internalServerError,
        });
    }

    const id = ins.insertId;

    const updDidSql = `UPDATE atributos SET did = ? WHERE id = ?`;
    await executeQuery(dbConnection, updDidSql, [id, id], true);

    const didVariante = id;

    const insertedValores = [];
    if (Array.isArray(varianteValores) && varianteValores.length > 0) {
        for (const v of varianteValores) {
            const valValor = isNonEmpty(v?.valor) ? String(v.valor).trim() : null;
            const valCodigo = isNonEmpty(v?.codigo) ? String(v.codigo).trim() : null;

            let valHab = 1;
            if (isDefined(v?.habilitado)) {
                const h = number01(v.habilitado);
                if (h !== 0 && h !== 1) {
                    throw new CustomException({
                        title: "Valor inválido en varianteValores",
                        message: "habilitado debe ser 0 o 1",
                        status: Status.badRequest,
                    });
                }
                valHab = h;
            }

            if (!isNonEmpty(valValor)) {
                throw new CustomException({
                    title: "Datos incompletos en varianteValores",
                    message: "Cada item debe incluir 'valor'",
                    status: Status.badRequest,
                });
            }

            const insValSql = `
        INSERT INTO atributos_valores (didAtributo, valor, codigo, habilitado, quien, superado, elim)
        VALUES (?, ?, ?, ?, ?, 0, 0)
      `;
            const insVal = await executeQuery(
                dbConnection,
                insValSql,
                [didVariante, valValor, valCodigo, valHab, userId]
            );

            if (!insVal || insVal.affectedRows === 0) {
                throw new CustomException({
                    title: "Error al crear valor",
                    message: "No se pudo insertar un valor de variante",
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
                didVariante: didVariante,
                valor: valValor,
                codigo: valCodigo,
                habilitado: valHab
            });
        }
    }

    return {
        success: true,
        message: "Variante creada correctamente",
        data: { id, did: didVariante, valores: insertedValores },
        meta: { timestamp: new Date().toISOString() },
    };
}

// ---------------- Helpers ----------------
const isDefined = (v) => v !== undefined && v !== null;
const isNonEmpty = (v) =>
    isDefined(v) && (typeof v !== "string" || v.trim() !== "");

const number01 = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) return -1;
    return n === 1 ? 1 : n === 0 ? 0 : -1;
};
