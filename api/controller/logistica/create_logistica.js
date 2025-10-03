import {
    CustomException, executeQuery, Status
} from "lightdata-tools";

/**
 * Alta de logistica y derivados (direcciones, contactos, cuentas).
 * - NO edita, NO borra, NO versiona: solo inserta.
 * Body:
 * {

 * }
 */
export async function createlogistica(db, req) {
    const {
        did,
        nombre,
        logisticaLD,
        codigo,
        codigoLD

    } = req.body || {};
    const { userId } = req.user;


    // ---------- Duplicados (logistica activo) ----------
    const logisticaDuplicada = await executeQuery(
        db,
        `SELECT * FROM logisticas WHERE superado = 0 AND elim = 0
        AND (did = ? OR nombre = ? OR logisticaLD = ? OR codigo = ? OR codigoLD = ?)
        LIMIT 1;`,
        [did, nombre, logisticaLD, codigo, codigoLD]
    );

    if (logisticaDuplicada?.length) {
        throw new CustomException({
            title: "Duplicado",
            message: "Ya existe un logistica activo con los mismos datos",
            status: Status.conflict,
        });
    }

    // ---------- Insert logistica ----------
    const insert = await executeQuery(
        db,
        `
      INSERT INTO logisticas
        (did, nombre, logisticaLD, codigo, codigoLD, quien, autofecha, superado)
      VALUES
        (?, ?, ?, ?, ?, ?, NOW(), 0)
    `,
        [did, nombre, logisticaLD, codigo, codigoLD, userId]
    );
    if (!insert?.affectedRows) {
        throw new CustomException({
            title: "Error al crear logistica",
            message: "No se pudo insertar el logistica",
            status: Status.internalServerError,
        });
    }
    const logisticaId = insert.insertId;


    // ---------- Respuesta ----------
    return {
        success: true,
        message: "logistica creada correctamente",
        data: {
            id: logisticaId,
            did: did,
            nombre: nombre,
            logisticaLD: logisticaLD,
            codigo: codigo,
            codigoLD: codigoLD,
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}