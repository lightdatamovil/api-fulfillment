import { CustomException, executeQuery, Status } from "lightdata-tools";

export async function createUsuario(dbConnection, req) {
    const b = req?.body ?? {};

    // --- Validaciones básicas ---
    const usuario = b.usuario;
    if (!usuario || typeof usuario !== "string") {
        throw new CustomException({
            status: Status.badRequest,
            message: "El campo 'usuario' es obligatorio.",
        });
    }

    const usuarioRegex = /^[a-zA-Z0-9_]+$/;
    if (!usuarioRegex.test(usuario)) {
        throw new CustomException({
            status: Status.badRequest,
            message: "El campo 'usuario' no puede contener caracteres especiales ni espacios.",
        });
    }

    // --- Chequeo de existencia ---
    const queryCheck =
        "SELECT usuario FROM usuarios WHERE usuario = ? AND superado = 0 AND elim = 0";
    const resultsCheck = await executeQuery(dbConnection, queryCheck, [usuario]);
    if (resultsCheck.length > 0) {
        throw new CustomException({
            status: Status.conflict,
            message: "El usuario ya existe.",
        });
    }

    // --- Whitelist de columnas permitidas (ajustá según tu tabla) ---
    const allowed = [
        "nombre",
        "apellido",
        "mail",
        "usuario",
        "contrasena",        // columna en DB
        "imagen",
        "habilitado",
        "perfil",
        "accesos",
        "modulo_inicial",
        "app_habilitada",
        "codigo_cliente",
        "telefono",
        "quien",
        "superado",
        "elim",
        "did",
    ];

    // Normalizo contraseña: si viene "contraseña" del front, la paso a "contrasena"
    const body = {
        nombre: b.nombre,
        apellido: b.apellido,
        mail: b.mail,
        usuario: b.usuario,
        contrasena: b.contrasena !== undefined ? b.contrasena : b["contraseña"],
        imagen: b.imagen,
        habilitado: b.habilitado,
        perfil: b.perfil,
        accesos: b.accesos,
        modulo_inicial: b.modulo_inicial,
        app_habilitada: b.app_habilitada,
        codigo_cliente: b.codigo_cliente,
        telefono: b.telefono,
        quien: b.quien,
        superado: b.superado,
        elim: b.elim,
        did: b.did,
    };

    // (Opcional) Normalizo booleans a 0/1 si tu DB usa TINYINT
    const boolCols = new Set(["habilitado", "app_habilitada", "superado", "elim"]);
    for (const k of Object.keys(body)) {
        if (boolCols.has(k) && typeof body[k] === "boolean") {
            body[k] = body[k] ? 1 : 0;
        }
    }

    // --- Filtrar solo columnas permitidas con valor definido ---
    const filteredColumns = allowed.filter((c) => body[c] !== undefined);
    if (filteredColumns.length === 0) {
        throw new CustomException({
            status: Status.badRequest,
            message: "No hay datos válidos para insertar.",
        });
    }

    const values = filteredColumns.map((c) => body[c]);
    const placeholders = filteredColumns.map(() => "?").join(", ");
    const insertQuery = `INSERT INTO usuarios (${filteredColumns.join(
        ", "
    )}) VALUES (${placeholders})`;

    const insertResult = await executeQuery(dbConnection, insertQuery, values);

    return {
        message: "Usuario creado correctamente.",
        body: insertResult.insertId
    };
}
