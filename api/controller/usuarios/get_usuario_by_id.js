import { LightdataORM } from "lightdata-tools";

export async function getUsuarioById({ db, req }) {
    const { userId } = req.params;

    const row = await LightdataORM.select({
        db,
        table: "usuarios",
        where: { did: userId },
        throwIfNotExists: true,
        select: ["did", "perfil", "nombre", "apellido", "email", "usuario", "habilitado", "modulo_inicial", "app_habilitada", "telefono", "codigo_cliente", "imagen"]
    });

    const [user] = row;

    return {
        success: true,
        message: "Usuario obtenido correctamente",
        data: {
            did: user.did,
            perfil: user.perfil,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            usuario: user.usuario,
            habilitado: user.habilitado,
            modulo_inicial: user.modulo_inicial,
            app_habilitada: user.app_habilitada,
            telefono: user.telefono,
            imagen: user.imagen,
            codigo_cliente: user.codigo_cliente
        },
        meta: {
            timestamp: new Date().toISOString(),
            filters: { userId }
        }
    };
}
