import { CustomException, executeQuery } from "lightdata-tools";

export async function getInsumosById({ db, req }) {
    const { insumoId } = req.params;

    const insumoRows = await executeQuery(
        db,
        `
    SELECT  did, codigo, nombre, unidad, habilitado
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

    const clientesRows = await executeQuery(
        db,
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
