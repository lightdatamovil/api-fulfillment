import { CustomException, executeQuery } from "lightdata-tools";

export async function createInsumo(dbConnection, req) {
    const { codigo, clientes, habilitado, nombre, unidad } = req.body;
    const { userId } = req.user;

    const clientesArr = Array.isArray(clientes)
        ? [...new Set(clientes.map(n => Number(n)).filter(Number.isFinite))]
        : [];

    const queryVerify = `
        SELECT id
        FROM insumos
        WHERE codigo = ? AND elim = 0 AND superado = 0
        LIMIT 1
    `;
    const dup = await executeQuery(dbConnection, queryVerify, [codigo]);
    if (dup.length > 0) {
        throw new CustomException({
            title: "Insumo existente",
            message: "Ya existe un insumo con ese código.",
        });
    }

    const insertQuery = `
    INSERT INTO insumos (codigo, nombre, unidad, habilitado, quien)
    VALUES (?, ?, ?, ?, ?)
  `;
    const insertResult = await executeQuery(dbConnection, insertQuery, [
        codigo,
        nombre,
        Number(unidad) || 0,
        Number(habilitado) || 0,
        userId,
    ]);

    if (!insertResult?.affectedRows) {
        throw new CustomException({
            title: "Error al crear insumo",
            message: "No se pudo insertar el insumo.",
        });
    }

    const newId = insertResult.insertId;

    await executeQuery(
        dbConnection,
        `UPDATE insumos SET did = ? WHERE id = ? LIMIT 1`,
        [newId, newId]
    );

    if (clientesArr.length > 0) {
        const values = clientesArr.map(cid => [newId, cid]);
        const insertClientes = `
      INSERT INTO insumos_clientes (did_insumo, did_cliente)
      VALUES ${values.map(() => "(?, ?)").join(",")}
    `;
        await executeQuery(dbConnection, insertClientes, values.flat());
    }

    const [insumoCreado] = await executeQuery(
        dbConnection,
        `SELECT id, did, nombre, codigo, unidad, habilitado, quien, autofecha, superado, elim
     FROM insumos
     WHERE id = ?`,
        [newId]
    );

    const clientesAsociados = await executeQuery(
        dbConnection,
        `SELECT did_cliente FROM insumos_clientes WHERE did_insumo = ?`,
        [newId]
    );

    return {
        success: true,
        message: "Insumo creado correctamente",
        data: {
            ...insumoCreado,
            clientes_ids: clientesAsociados.map(r => r.did_cliente),
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
