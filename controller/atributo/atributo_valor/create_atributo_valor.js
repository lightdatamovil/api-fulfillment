import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Crea un valor para un atributo.
 * Body soportado: { didAtributo, valor, codigo?, habilitado?, didProducto? }
 */
export async function createAtributoValor(connection, req) {
  const { atributoId } = req.params;
  const { valor, codigo, habilitado } = req.body ?? {};
  const { userId } = req.user ?? {};

  const valValor = String(valor).trim();
  if (!valValor) {
    throw new CustomException({
      title: "Valor inválido",
      message: "El campo 'valor' no puede estar vacío",
      status: Status.badRequest,
    });
  }

  let valHab = 1;
  if (habilitado !== undefined) {
    const h = number01(habilitado);
    if (h !== 0 && h !== 1) {
      throw new CustomException({
        title: "Valor inválido",
        message: "habilitado debe ser 0 o 1",
        status: Status.badRequest,
      });
    }
    valHab = h;
  }

  const valCodigo = isNonEmpty(codigo) ? String(codigo).trim() : null;

  // --- Insert ---
  const insertSql = `
        INSERT INTO atributos_valores 
            ( didAtributo, valor, codigo, habilitado, quien, superado, elim)
        VALUES (?, ?, ?, ?, ?, 0, 0)
    `;
  const ins = await executeQuery(
    connection,
    insertSql,
    [atributoId, valValor, valCodigo, valHab, userId],
    true
  );

  if (!ins || ins.affectedRows === 0) {
    throw new CustomException({
      title: "Error al crear valor",
      message: "No se pudo insertar el valor del atributo",
      status: Status.internalServerError,
    });
  }

  const id = ins.insertId;

  await executeQuery(connection, `UPDATE atributos_valores SET did = ? WHERE id = ?`, [id, id], true);

  return {
    success: true,
    message: "Atributo valor creado correctamente",
    data: {
      id,
      did: id,
      didAtributo: Number(atributoId),
      valor: valValor,
      codigo: valCodigo,
      habilitado: valHab,
    },
    meta: { timestamp: new Date().toISOString() },
  };
}

/* Helpers */
const isDefined = (v) => v !== undefined && v !== null;
const isNonEmpty = (v) => isDefined(v) && (typeof v !== "string" || v.trim() !== "");
const number01 = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return -1;
  return n === 1 ? 1 : n === 0 ? 0 : -1;
};
