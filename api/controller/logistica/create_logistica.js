import { CustomException, executeQuery, Status } from "lightdata-tools";


/**
 * Alta de logistica y derivados (direcciones, contactos, cuentas).
 * - NO edita, NO borra, NO versiona: solo inserta.
 * Body:
 * {

 * }
 */
export async function createlogistica(db, req) {
    const {
        nombre,
        logisticaLD,
        codigo

    } = req.body || {};
    const { userId } = req.user;
    let codigoLD = null;
    if (req.body.codigoLD) {
        codigoLD = req.body.codigoLD;
    }
    let direcciones = req.body.direcciones ?? {};
    const { cp, calle, pais, localidad, numero, provincia, address_line, habilitado = 0 } = direcciones;


    // ---------- Duplicados (logistica activo) ----------
    const logisticaDuplicada = await executeQuery(
        db,
        `SELECT * FROM logisticas WHERE 
        (nombre = ? OR codigo = ? OR codigoLD = ?) AND superado = 0 AND elim = 0
        LIMIT 1;`,
        [nombre, codigo, codigoLD]
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
        (nombre, logisticaLD, codigo, codigoLD, quien, autofecha, superado, habilitado)
      VALUES
        (?, ?, ?, ?, ?, NOW(), 0, ?)
    `,
        [nombre, logisticaLD, codigo, codigoLD, userId, habilitado]
    );
    if (!insert?.affectedRows) {
        throw new CustomException({
            title: "Error al crear logistica",
            message: "No se pudo insertar el logistica",
            status: Status.internalServerError,
        });
    }
    const logisticaId = insert.insertId;


    //actualizar did
    const did = await executeQuery(db, "UPDATE logisticas SET did = ?  WHERE id = ?", [logisticaId, logisticaId]);
    if (!did?.affectedRows) {
        throw new CustomException({
            title: "Error al actualizar did del logistica",
            message: "No se pudo actualizar el did del logistica",
            status: Status.internalServerError,
        });
    }

    //llevar datos a direcciones
    const direccionInsert = await executeQuery(
        db, ` INSERT INTO logisticas_direcciones
        (did_logistica, cp, calle, pais, localidad, numero, provincia, address_line, quien, autofecha, superado, elim)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 0, 0)
    `,
        [logisticaId, cp, calle, pais, localidad, numero, provincia, address_line, userId]
    );
    if (!direccionInsert?.affectedRows) {
        throw new CustomException({
            title: "Error al crear direccion",
            message: "No se pudo insertar la direccion",
            status: Status.internalServerError,
        });
    }
    const didDirecciones = direccionInsert.insertId;

    //actualizar did

    const insertDidDirecciones = await executeQuery(db, "UPDATE logisticas_direcciones SET did = ? WHERE id = ?", [didDirecciones, didDirecciones]);
    if (!insertDidDirecciones?.affectedRows) {
        throw new CustomException({
            title: "Error al actualizar did de la direccion",
            message: "No se pudo actualizar el did de la direccion",
            status: Status.internalServerError,
        });
    }



    // ---------- Respuesta ----------
    return {
        success: true,
        message: "logistica creada correctamente",
        data: {
            id: logisticaId,
            did: logisticaId,
            nombre: nombre,
            logisticaLD: logisticaLD,
            codigo: codigo,
            codigoLD: codigoLD,
            habilitado: habilitado,
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}

