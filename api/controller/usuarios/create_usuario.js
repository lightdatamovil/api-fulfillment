import axios from "axios";
import { CustomException, Status, toStr, toBool01, toInt, hashPassword, emptyToNull, LightdataORM, executeQuery } from "lightdata-tools";
import { debugHttpError } from "../../src/functions/debugEndpoint.js";

const UPLOAD_URL = "https://files.lightdata.app/upload_fulfillment_images.php";


export async function createUsuario(dbConnection, req) {
    const { companyId } = req.user;
    const data = req.body;
    const quien = req.user.userId;

    const nombre = toStr(data.nombre);
    const apellido = toStr(data.apellido);
    const email = toStr(data.email);
    const usuario = toStr(data.usuario);
    const passRaw = toStr(data.contrasena ?? data["contraseña"] ?? data.pass ?? data.password);
    const perfil = toInt(data.perfil, undefined);

    const habilitado = toBool01(data.habilitado, 1);
    const app_habilitada = toBool01(data.app_habilitada, 0);
    const telefono = toStr(data.telefono);
    const codigo_cliente = toStr(data.codigo_cliente);
    const modulo_inicial = toStr(data.modulo_inicial);
    const imagen = toStr(data.imagen);

    const usuarioRegex = /^[a-zA-Z0-9_]+$/;
    if (!usuarioRegex.test(usuario)) {
        throw new CustomException({
            status: Status.badRequest,
            title: "Usuario inválido",
            message: "El 'usuario' no puede contener espacios ni caracteres especiales."
        });
    }

    const existingUser = await executeQuery(
        dbConnection,
        `SELECT did FROM usuarios WHERE (usuario = ? OR email = ?) AND superado = 0 AND elim = 0 LIMIT 1`,
        [usuario, email]
    );

    if (existingUser.length > 0) {
        throw new CustomException({
            status: Status.conflict,
            title: "Conflicto de usuario",
            message: "El 'usuario' o 'email' ya están en uso."
        });
    }

    const pass = await hashPassword(passRaw);

    const dataInsert = {
        nombre,
        apellido: emptyToNull(apellido),
        email: emptyToNull(email),
        usuario,
        pass,
        perfil,
        habilitado,
        modulo_inicial: emptyToNull(modulo_inicial),
        app_habilitada,
        telefono: emptyToNull(telefono),
        codigo_cliente: emptyToNull(codigo_cliente),
        image: null,
    };

    const userInsert = await LightdataORM.insert({
        dbConnection,
        table: "usuarios",
        data: dataInsert,
        quien: quien,
    });

    const didUserInsert = userInsert[0];


    let insertImage = null;

    if (data.imagen) {
        try {
            const payload = {
                companyId: companyId,
                userId: didUserInsert,
                file: imagen
            };
            //  console.log(payload);

            const uploadRes = await axios.post(
                UPLOAD_URL,
                payload,
                { headers: { "Content-Type": "application/json" } }
            );
            insertImage = uploadRes.data.file.url;
            await executeQuery(
                dbConnection,
                `UPDATE usuarios SET imagen = ? WHERE did = ?`,
                [insertImage, didUserInsert], true
            );

        } catch (err) {
            //    debugHttpError(err, "upload");
            throw new CustomException({
                status: Status.badGateway,
                message: "Error al subir la imagen"
            });
        }

    }

    return {
        success: true,
        message: "Usuario creado correctamente",
        data: {
            did: didUserInsert,
            perfil, nombre, apellido: apellido ?? null, email: email, usuario, habilitado,
            modulo_inicial: modulo_inicial ?? null,
            app_habilitada,
            telefono: telefono ?? null,
            codigo_cliente: codigo_cliente ?? null,
            imagen: insertImage ?? null,
        },
        meta: { timestamp: new Date().toISOString() }
    };

}



