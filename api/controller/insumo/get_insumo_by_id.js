import { CustomException, executeQuery } from "lightdata-tools";

export async function getInsumosById(dbConnection, req) {
    const { insumoId } = req.params;

    // 1) Traer la versión activa del insumo
    const insumoRows = await executeQuery(
        dbConnection,
        `
    SELECT id, did, codigo, nombre, unidad, habilitado, quien, autofecha, superado, elim
    FROM insumos
    WHERE did = ? AND elim = 0 AND superado = 0
    LIMIT 1
    `,
        [insumoId]
    );

    if (!insumoRows.length) {
        throw new CustomException({
            title: "Insumo no encontrado",
            message: "No se encontró el insumo con el ID proporcionado.",
        });
    }

    const insumo = insumoRows[0];

    // 2) Traer los clientes asociados activos
    const clientesRows = await executeQuery(
        dbConnection,
        `
    SELECT did_cliente
    FROM insumos_clientes
    WHERE did_insumo = ? AND superado = 0 AND elim = 0
    ORDER BY did_cliente ASC
    `,
        [insumoId]
    );

    const clientes_dids = clientesRows.map(r => r.did_cliente);

    return {
        success: true,
        message: "Insumo obtenido correctamente",
        data: { ...insumo, clientes_dids },
        meta: { timestamp: new Date().toISOString() },
    };
}
