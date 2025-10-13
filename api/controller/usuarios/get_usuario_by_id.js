import { LightdataORM } from "lightdata-tools";

export async function getUsuarioById(dbConnection, req) {
    const { userId } = req.params;

    const row = await LightdataORM.select(
        {
            dbConnection,
            table: "usuarios",
            column: "did",
            value: userId,
            throwExceptionIfNotExists: true,
            select: "did, perfil, nombre, apellido, mail, usuario, habilitado, modulo_inicial, app_habilitada, telefono, codigo_cliente"
        }
    )

    return {
        success: true,
        message: "Usuario obtenido correctamente",
        data: {
            did: row.did,
            perfil: row.perfil,
            nombre: row.nombre,
            apellido: row.apellido,
            email: row.mail,
            usuario: row.usuario,
            habilitado: row.habilitado,
            modulo_inicial: row.modulo_inicial,
            app_habilitada: row.app_habilitada,
            telefono: row.telefono,
            codigo_cliente: row.codigo_cliente
        },
        meta: {
            timestamp: new Date().toISOString(),
            filters: { userId }
        }
    };
}
