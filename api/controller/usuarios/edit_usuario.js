import { CustomException, executeQuery, Status, isNonEmpty, isDefined, number01, sha256, emptyToNull } from "lightdata-tools";

/**
 * Edita un usuario existente (versionado por did):
 * - Verifica existencia (did = :userId).
 * - Valida unicidad de usuario y mail si se modifican.
 * - Valida campos y normaliza booleanos a 0/1.
 * - Marca superado=1 en versión activa.
 * - Inserta nueva fila con mismo did y cambios.
 */
export async function editUsuario(dbConnection, req) {
    const {
        nombre, apellido, mail, email,
        usuario, password, pass, contrasena, contraseña,
        imagen, habilitado, perfil,
        modulo_inicial, app_habilitada,
        telefono, codigo_cliente
    } = req.body ?? {};
    const { userId } = req.params;      // did del usuario a editar

    // 1) Verificar existencia (traigo también pass actual)
    const qGet = `
        SELECT did, nombre, apellido, mail, usuario, pass, imagen,
               habilitado, perfil, modulo_inicial, app_habilitada,
               telefono, codigo_cliente
        FROM usuarios
        WHERE did = ? AND elim = 0 AND superado = 0
        LIMIT 1
    `;
    const rows = await executeQuery(dbConnection, qGet, [userId]);
    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "Usuario no encontrado",
            message: `No existe usuario con did=${userId}`,
            status: Status.notFound,
        });
    }
    const current = rows[0];

    // 2) Validaciones de cambio para usuario/mail (unicidad)
    const nextUsuario = isNonEmpty(usuario) ? String(usuario).trim() : current.usuario;
    const nextMail = isNonEmpty(email ?? mail) ? String(email ?? mail).trim() : current.mail;

    // regex usuario
    if (nextUsuario && !/^[a-zA-Z0-9_]+$/.test(nextUsuario)) {
        throw new CustomException({
            title: "Usuario inválido",
            message: "El 'usuario' no puede contener espacios ni caracteres especiales.",
            status: Status.badRequest,
        });
    }

    if (nextUsuario.toLowerCase() !== String(current.usuario).toLowerCase()) {
        const qDupUser = `
            SELECT did FROM usuarios
            WHERE LOWER(usuario)=LOWER(?) AND elim=0 AND superado=0 AND did <> ?
            LIMIT 1
        `;
        const dupU = await executeQuery(dbConnection, qDupUser, [nextUsuario, userId]);
        if (dupU?.length) {
            throw new CustomException({
                title: "Usuario duplicado",
                message: `Ya existe un usuario con nombre "${nextUsuario}".`,
                status: Status.conflict,
            });
        }
    }

    if (nextMail.toLowerCase() !== String(current.mail).toLowerCase()) {
        const qDupMail = `
            SELECT did FROM usuarios
            WHERE LOWER(email)=LOWER(?) AND elim=0 AND superado=0 AND did <> ?
            LIMIT 1
        `;
        const dupM = await executeQuery(dbConnection, qDupMail, [nextMail, userId]);
        if (dupM?.length) {
            throw new CustomException({
                title: "Email duplicado",
                message: `El email "${nextMail}" ya está registrado.`,
                status: Status.conflict,
            });
        }
    }

    // 3) Preparar nuevos valores (fallback a current)
    const nextNombre = isNonEmpty(nombre) ? String(nombre).trim() : current.nombre;
    const nextApellido = isNonEmpty(apellido) ? String(apellido).trim() : current.apellido;
    const nextImagen = isNonEmpty(imagen) ? String(imagen).trim() : current.imagen;
    const nextPerfil = isDefined(perfil) ? parseInt(perfil, 10) : current.perfil;
    const nextModuloInicial = isNonEmpty(modulo_inicial) ? String(modulo_inicial).trim() : current.modulo_inicial;
    const nextTelefono = isNonEmpty(telefono) ? String(telefono).trim() : current.telefono;
    const nextCodigoCliente = isNonEmpty(codigo_cliente) ? String(codigo_cliente).trim() : current.codigo_cliente;

    let nextHabilitado = current.habilitado;
    if (isDefined(habilitado)) {
        const h = number01(habilitado);
        if (h !== 0 && h !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "habilitado debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        nextHabilitado = h;
    }

    let nextAppHabilitada = current.app_habilitada;
    if (isDefined(app_habilitada)) {
        const a = number01(app_habilitada);
        if (a !== 0 && a !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "app_habilitada debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        nextAppHabilitada = a;
    }

    // pass (si viene nueva, se hashea; si no, se mantiene)
    const incomingPass = contrasena ?? contraseña ?? password ?? pass;
    const nextPass = isNonEmpty(incomingPass)
        ? sha256(String(incomingPass))
        : current.pass;

    // 4) Marcar superado=1 en versión activa
    await executeQuery(
        dbConnection,
        `UPDATE usuarios SET superado = 1 WHERE did = ? AND elim = 0 AND superado = 0`,
        [userId]
    );

    // 5) Insertar nueva versión (superado=0)
    const insertSql = `
        INSERT INTO usuarios
            (did, nombre, apellido, mail, usuario, pass, imagen,
             habilitado, perfil, modulo_inicial, app_habilitada,
             telefono, codigo_cliente,  superado, elim)
        VALUES
            (?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?,
             ?, ?, ?, 0, 0)
    `;
    const insertParams = [
        userId,
        emptyToNull(nextNombre),
        emptyToNull(nextApellido),
        nextMail,
        nextUsuario,
        nextPass,
        emptyToNull(nextImagen),
        nextHabilitado,
        nextPerfil,
        emptyToNull(nextModuloInicial),
        nextAppHabilitada,
        emptyToNull(nextTelefono),
        emptyToNull(nextCodigoCliente),
    ];

    const insertResult = await executeQuery(dbConnection, insertSql, insertParams);
    if (!insertResult || insertResult.affectedRows === 0) {
        throw new CustomException({
            title: "Error al versionar usuario",
            message: "No se pudo crear la nueva versión del usuario",
            status: Status.internalServerError,
        });
    }

    return {
        success: true,
        message: "Usuario actualizado correctamente",
        data: { did: Number(userId) },
        meta: { timestamp: new Date().toISOString() },
    };
}
