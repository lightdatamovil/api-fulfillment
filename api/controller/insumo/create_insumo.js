import { CustomException, executeQuery, LightdataQuerys } from "lightdata-tools";

export async function createInsumo(dbConnection, req) {
    const { codigo, clientes_dids, habilitado, nombre, unidad } = req.body;
    const { userId } = req.user;

    const clientesArr = new Set(clientes_dids.map(n => Number(n)));

    const qVerify = `
        SELECT *
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

    const [newId] = await LightdataQuerys.insert({
        dbConnection,
        tabla: "insumos",
        quien: userId,
        data: { codigo, nombre, unidad, habilitado },
    });


    if (clientesArr.length > 0) {
        const values = clientesArr.map(clientDid => [newId, clientDid, userId, 0, 0]);
        const qLink = `
            INSERT INTO insumos_clientes (did_insumo, did_cliente, quien, superado, elim)
            VALUES ${values.map(() => "(?, ?, ?, ?, ?)").join(",")}
        `;
        await executeQuery(dbConnection, qLink, values.flat());
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
