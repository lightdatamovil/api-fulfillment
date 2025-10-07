import { executeQuery, LightdataQuerys } from "lightdata-tools";


export async function deleteInsumo(dbConnection, req) {
    const { insumoId } = req.params;
    const { userId } = req.user;

    await LightdataQuerys.delete({
        dbConnection,
        tabla: "insumos",
        did: insumoId,
        quien: userId
    });

    const qDelLinks = `
        UPDATE insumos_clientes
        SET elim = 1
        WHERE did_insumo = ? AND superado = 0 AND elim = 0
    `;
    await executeQuery(dbConnection, qDelLinks, [insumoId]);

    return {
        success: true,
        message: "Insumo eliminado correctamente",
        data: { did: insumoId },
        meta: { timestamp: new Date().toISOString() },
    };
}
