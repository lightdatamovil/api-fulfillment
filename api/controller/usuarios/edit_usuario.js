import axios from "axios";
import { CustomException, hashPassword, isNonEmpty, LightdataORM, Status } from "lightdata-tools";
import { debugHttpError } from "../../src/functions/debugEndpoint.js";
import { urlSubidaImagenes } from "../../db.js";

export async function editUsuario({ db, req }) {
    const {
        nombre, apellido, email,
        usuario, pass, imagen,
        habilitado, perfil, accesos, tipo,
        modulo_inicial, app_habilitada,
        telefono, codigo_cliente
    } = req.body;
    const { userId } = req.params;
    const { companyId } = req.user;
    const quien = req.user.userId;

    let imageInsert = null;

    const userVerify = await LightdataORM.select(
        {
            db,
            table: "usuarios",
            where: { did: userId },
            throwExceptionIfNotExists: true,
            select: ["did", "perfil", "nombre", "apellido", "email", "usuario", "habilitado", "modulo_inicial", "app_habilitada", "telefono", "codigo_cliente", "imagen"]
        }
    )

    const passHasheada = await hashPassword(pass);

    let imageUrl = userVerify[0].imagen;
    if (imagen !== imageUrl) {
        if (isNonEmpty(imagen)) {
            try {
                const payload = {
                    companyId: companyId,
                    userId: userId,
                    file: imagen
                };

                const uploadRes = await axios.post(
                    urlSubidaImagenes,
                    payload,
                    { headers: { "Content-Type": "application/json" } }
                );
                imageInsert = uploadRes.data.file.url;

            } catch (err) {
                debugHttpError(err, "upload");
                throw new CustomException({
                    status: Status.badGateway,
                    message: "Error al subir la imagen"
                });
            }
        }

    } else {
        imageInsert = imageUrl;
    }
    await LightdataORM.update(
        {
            db,
            table: "usuarios",
            where: { did: userId },
            quien: quien,
            data: {
                nombre: nombre,
                apellido: apellido,
                email: email,
                usuario: usuario,
                pass: passHasheada,
                imagen: imageInsert,
                habilitado: habilitado,
                perfil: perfil,
                accesos: accesos,
                tipo: tipo,
                modulo_inicial: modulo_inicial,
                app_habilitada: app_habilitada,
                telefono: telefono,
                codigo_cliente: codigo_cliente
            }
        });

    return {
        success: true,
        message: "Usuario actualizado correctamente",
        data: { did: Number(userId) },
        meta: { timestamp: new Date().toISOString() },
    };
}
