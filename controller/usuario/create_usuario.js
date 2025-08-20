import { CustomException, executeQuery, Status } from "lightdata-tools";
import crypto from "crypto";

const toStr = (v) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s.length ? s : undefined;
};
const toInt = (v, def) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) ? n : def;
};
const toBool01 = (v, def) => {
    const s = String(v ?? "").toLowerCase();
    if (["true", "1", "yes", "si", "on"].includes(s)) return 1;
    if (["false", "0", "no", "off"].includes(s)) return 0;
    return def;
};
const emptyToNull = (v) => (typeof v === "string" && v.trim() === "" ? null : v);
const hashPassword = (plain) => crypto.createHash("sha256").update(String(plain)).digest("hex");

export async function createUsuario(dbConnection, req) {
    const b = req?.body ?? {};

    // --- normalización básica ---
    const nombre = toStr(b.nombre);
    const apellido = toStr(b.apellido);
    const mail = toStr(b.mail ?? b.email);
    const usuario = toStr(b.usuario);
    const passRaw = toStr(b.contrasena ?? b["contraseña"] ?? b.pass ?? b.password);
    const perfil = toInt(b.perfil, undefined);

    const habilitado = toBool01(b.habilitado, 1);   // default 1
    const app_habilitada = toBool01(b.app_habilitada, 0); // default 0
    const telefono = toStr(b.telefono);
    const codigo_cliente = toStr(b.codigo_cliente);
    const modulo_inicial = toStr(b.modulo_inicial);

    // --- validaciones mínimas ---
    if (!usuario || !passRaw || !mail || !nombre || perfil === undefined) {
        throw new CustomException({
            status: Status.badRequest,
            title: "Datos incompletos",
            message: "Campos obligatorios: nombre, mail, usuario, contraseña y perfil."
        });
    }

    const usuarioRegex = /^[a-zA-Z0-9_]+$/;
    if (!usuarioRegex.test(usuario)) {
        throw new CustomException({
            status: Status.badRequest,
            title: "Usuario inválido",
            message: "El 'usuario' no puede contener espacios ni caracteres especiales."
        });
    }

    // --- unicidad (case-insensitive) ---
    const existsUser = await executeQuery(
        dbConnection,
        `SELECT 1 FROM usuarios WHERE LOWER(usuario)=LOWER(?) AND superado=0 AND elim=0 LIMIT 1`,
        [usuario]
    );
    if (existsUser?.length) {
        throw new CustomException({ status: Status.conflict, message: "El usuario ya existe." });
    }

    const existsMail = await executeQuery(
        dbConnection,
        `SELECT 1 FROM usuarios WHERE LOWER(mail)=LOWER(?) AND superado=0 AND elim=0 LIMIT 1`,
        [mail]
    );
    if (existsMail?.length) {
        throw new CustomException({ status: Status.conflict, message: "El email ya está registrado." });
    }

    // --- INSERT (no permito setear did/superado/elim/accesos/quien desde el front) ---
    const pass = hashPassword(passRaw);

    const insertSql = `
    INSERT INTO usuarios
      (nombre, apellido, mail, usuario, pass, perfil, habilitado,
       modulo_inicial, app_habilitada, telefono, codigo_cliente,
       superado, elim)
    VALUES
      (?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       0, 0)
  `;
    const insertParams = [
        nombre,
        emptyToNull(apellido),
        mail,
        usuario,
        pass,
        perfil,
        habilitado,
        emptyToNull(modulo_inicial),
        app_habilitada,
        emptyToNull(telefono),
        emptyToNull(codigo_cliente)
    ];

    const ins = await executeQuery(dbConnection, insertSql, insertParams, true);
    const insertedId = ins?.insertId ?? ins?.[0]?.insertId;
    if (!insertedId) {
        throw new CustomException({
            status: Status.internalServerError,
            title: "Error de inserción",
            message: "No se obtuvo insertId."
        });
    }

    // --- did = id ---
    await executeQuery(dbConnection, `UPDATE usuarios SET did = ? WHERE id = ?`, [insertedId, insertedId], true);

    // --- fetch final limpio ---
    const row = (await executeQuery(
        dbConnection,
        `SELECT
        did, perfil, nombre, apellido, mail, usuario, habilitado,
        modulo_inicial, app_habilitada, telefono, codigo_cliente
     FROM usuarios
     WHERE id = ? AND elim = 0 AND superado = 0
     LIMIT 1`,
        [insertedId]
    ))?.[0];

    return {
        success: true,
        message: "Usuario creado correctamente",
        data: row ?? {
            did: insertedId,
            perfil, nombre, apellido: apellido ?? null, mail, usuario, habilitado,
            modulo_inicial: modulo_inicial ?? null,
            app_habilitada,
            telefono: telefono ?? null,
            codigo_cliente: codigo_cliente ?? null
        },
        meta: { timestamp: new Date().toISOString() }
    };
}
