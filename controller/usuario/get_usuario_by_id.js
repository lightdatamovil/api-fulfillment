import { executeQuery } from "lightdata-tools"

export async function getUsuarioById(dbConnection, req) {
    const { userId } = req.params;

    const query = `
    SELECT
        perfil,
        nombre,
        apellido,
        mail,
        usuario,
        habilitado,
        did,
        modulo_inicial,
        app_habilitada,
        telefono,
        codigo_cliente
    FROM usuarios
    WHERE
        did = ?
        AND superado = 0
        AND  elim = 0`;

    const results = await executeQuery(dbConnection, query, [userId]);

    const row = results[0];

    return {
        nombre: row.nombre,
        apellido: row.apellido,
        mail: row.mail,
        usuario: row.usuario,
        habilitado: row.habilitado,
        did: row.did,
        modulo_inicial: row.modulo_inicial,
        app_habilitada: row.app_habilitada,
        telefono: row.telefono,
        codigo_cliente: row.codigo_cliente
    }
}