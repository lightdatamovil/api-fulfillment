import { CustomException, executeQuery } from "lightdata-tools";

/**
 * Crea un insumo y vincula clientes (opcional).
 * req.body:
 *  - codigo: string
 *  - nombre: string
 *  - unidad: number
 *  - habilitado: 0|1
 *  - clientes?: number[]   // ids de cliente a asociar
 */
export async function createInsumo(dbConnection, req) {
    const { codigo, clientes, habilitado, nombre, unidad } = req.body;
    const { userId } = req.user;

    const clientesArr = Array.isArray(clientes)
        ? [...new Set(clientes.map(n => Number(n)).filter(Number.isFinite))]
        : [];

    if (!codigo || !nombre) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Faltan 'codigo' o 'nombre'.",
        });
    }

    // 1) Verificar duplicado (insumo activo)
    const qVerify = `
    SELECT id
    FROM insumos
    WHERE codigo = ? AND elim = 0 AND superado = 0
    LIMIT 1
  `;
    const dup = await executeQuery(dbConnection, qVerify, [codigo]);
    if (dup.length > 0) {
        throw new CustomException({
            title: "Insumo existente",
            message: "Ya existe un insumo con ese código.",
        });
    }

    // 2) Insertar insumo (sin did)
    const qInsert = `
    INSERT INTO insumos (codigo, nombre, unidad, habilitado, quien)
    VALUES (?, ?, ?, ?, ?)
  `;
    const ins = await executeQuery(dbConnection, qInsert, [
        String(codigo).trim(),
        String(nombre).trim(),
        Number(unidad) || 0,
        Number(habilitado) || 0,
        userId,
    ]);

    if (!ins?.affectedRows) {
        throw new CustomException({
            title: "Error al crear insumo",
            message: "No se pudo insertar el insumo.",
        });
    }

    const newId = ins.insertId;

    // 3) Setear did = id
    await executeQuery(
        dbConnection,
        `UPDATE insumos SET did = ? WHERE id = ? LIMIT 1`,
        [newId, newId]
    );

    // 4) Vincular clientes con nueva estructura (quien, superado, elim)
    if (clientesArr.length > 0) {
        const values = clientesArr.map(cid => [newId, cid, userId, 0, 0]);
        const qLink = `
      INSERT INTO insumos_clientes (did_insumo, did_cliente, quien, superado, elim)
      VALUES ${values.map(() => "(?, ?, ?, ?, ?)").join(",")}
    `;
        await executeQuery(dbConnection, qLink, values.flat());
        // Si tu columna autofecha tiene DEFAULT CURRENT_TIMESTAMP, no es necesario incluirla.
    }

    // 5) Devolver insumo y asociaciones
    const [insumoCreado] = await executeQuery(
        dbConnection,
        `SELECT id, did, nombre, codigo, unidad, habilitado, quien, autofecha, superado, elim
     FROM insumos
     WHERE id = ?`,
        [newId]
    );

    const clientesAsociados = await executeQuery(
        dbConnection,
        `SELECT did_cliente
     FROM insumos_clientes
     WHERE did_insumo = ? AND elim = 0 AND superado = 0
     ORDER BY did_cliente ASC`,
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
