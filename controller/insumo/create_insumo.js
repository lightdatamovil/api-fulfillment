import { CustomException, executeQuery } from "lightdata-tools"

export async function createInsumo(dbConnection, req) {
    const { did, codigo, clientes, habilitado, nombre, unidad } = req.body;
    const { userId } = req.user;

    const queryVerify = `
        SELECT * FROM insumos WHERE codigo = ? AND did = ? AND elim = 0 AND superado = 0
    `;
    const existingInsumo = await executeQuery(dbConnection, queryVerify, [codigo, did]);

    if (existingInsumo.length > 0) {
        throw new CustomException({
            title: "Insumo existente",
            message: "El insumo ya existe"
        });
    }

    const insertQuery = `
        INSERT INTO insumos (codigo, clientes, habilitado, nombre, unidad, quien)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const insertResult = await executeQuery(dbConnection, insertQuery, [codigo, clientes, habilitado, nombre, unidad, userId]);

    if (!insertResult || insertResult.affectedRows === 0) {
        throw new CustomException({
            title: "Error al crear insumo",
            message: "No se pudo crear el insumo"
        });
    }

    const updateDidQuery = `
        UPDATE insumos SET did = ? WHERE id = ?
    `;
    await executeQuery(dbConnection, updateDidQuery, [insertResult.insertId, insertResult.insertId], true);

    const q = 'SELECT * FROM insumos WHERE did = ?';
    const insumoCreado = await executeQuery(dbConnection, q, [insertResult.insertId]);

    return {
        success: true,
        message: "Insumo creado correctamente",
        data: insumoCreado,
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}