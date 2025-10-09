import axios from "axios";
import { CustomException, Status, toStr, toBool01, toInt, hashPassword, emptyToNull, LightdataQuerys, executeQuery } from "lightdata-tools";

const UPLOAD_URL = "https://files.lightdata.app/upload_fulfillment_images.php";


export async function createUsuario(dbConnection, req) {
    const didLogistica = req.params.didLogistica;
    const data = req?.body ?? {};
    const quien = req.user;

    // --- normalización básica ---
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

    const userIdInsert = await LightdataQuerys.insert({
        dbConnection,
        table: "usuarios",
        data: dataInsert,
        quien: quien,
    });

    if (data.imagen) {
        try {
            const uploadRes = await axios.post(
                UPLOAD_URL,
                {
                    companyId: didLogistica,
                    userId: userIdInsert,
                    file: imagen
                },
                { headers: { "Content-Type": "application/json" } }
            );

            console.log("uploadRes", uploadRes);
            const insertImage = uploadRes.file.url;
            console.log("insertImage", insertImage);


            await executeQuery(
                dbConnection,
                `UPDATE usuarios SET image = ? WHERE did = ?`,
                [insertImage, userIdInsert], true
            );

        } catch (err) {
            debugHttpError(err, "upload");
            throw new CustomException({
                status: Status.badGateway,
                message: "Error al subir la imagen"
            });
        }


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


}
export function debugHttpError(err, ctx = "http") {
    const status = err.response?.status;
    const statusText = err.response?.statusText;
    const body = err.response?.data;

    console.error(`[${ctx}] AxiosError ${status ?? "(sin status)"} ${statusText ?? ""}`.trim());
    if (body !== undefined) {
        console.error(`[${ctx}] body:`, typeof body === "string" ? body : JSON.stringify(body));
    }
    console.error(`[${ctx}] message:`, err.message);

}