import axios from "axios";
import { CustomException, Status, toStr, toBool01, toInt, hashPassword, emptyToNull, LightdataQuerys } from "lightdata-tools";
const UPLOAD_URL = "url-generico";
export async function createUsuario(dbConnection, req) {
    const b = req?.body ?? {};

    // --- normalización básica ---
    const nombre = toStr(b.nombre);
    const apellido = toStr(b.apellido);
    const email = toStr(b.email);
    const usuario = toStr(b.usuario);
    const passRaw = toStr(b.contrasena ?? b["contraseña"] ?? b.pass ?? b.password);
    const perfil = toInt(b.perfil, undefined);

    const habilitado = toBool01(b.habilitado, 1);
    const app_habilitada = toBool01(b.app_habilitada, 0);
    const telefono = toStr(b.telefono);
    const codigo_cliente = toStr(b.codigo_cliente);
    const modulo_inicial = toStr(b.modulo_inicial);
    const imagen = toStr(b.imagen);

    const usuarioRegex = /^[a-zA-Z0-9_]+$/;
    if (!usuarioRegex.test(usuario)) {
        throw new CustomException({
            status: Status.badRequest,
            title: "Usuario inválido",
            message: "El 'usuario' no puede contener espacios ni caracteres especiales."
        });
    }


    // --- unicidad (case-insensitive) ---
    await LightdataQuerys.select({
        dbConnection,
        table: "usuarios",
        column: "did",
        value: usuario,
        throwExceptionIfAlreadyExists: true
    });

    // --- INSERT (no permito setear did/superado/elim/accesos/quien desde el front) ---
    const pass = await hashPassword(passRaw);

    //subir imagen al microservicio de archivos
    const uploadRes = await axios.post(
        UPLOAD_URL,
        { image: imagen },
        { headers: { "Content-Type": "application/json" } }
    );

    const data = uploadRes?.data;

    const insertImage = null;

    const userIdInsert = await LightdataQuerys.insert({
        dbConnection,
        table: "usuarios",
        data: {
            nombre,
            apellido: emptyToNull(apellido),
            mail: email,
            usuario,
            pass,
            perfil,
            habilitado,
            modulo_inicial: emptyToNull(modulo_inicial),
            app_habilitada,
            telefono: emptyToNull(telefono),
            codigo_cliente: emptyToNull(codigo_cliente),
            image: insertImage,
            superado: 0,
            elim: 0
        }
    });


    return {
        success: true,
        message: "Usuario creado correctamente",
        data: {
            did: userIdInsert,
            perfil, nombre, apellido: apellido ?? null, email: email, usuario, habilitado,
            modulo_inicial: modulo_inicial ?? null,
            app_habilitada,
            telefono: telefono ?? null,
            codigo_cliente: codigo_cliente ?? null
        },
        meta: { timestamp: new Date().toISOString() }
    };
}
