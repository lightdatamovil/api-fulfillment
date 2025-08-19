import { CustomException, executeQuery } from "lightdata-tools"

export async function deleteInsumo(dbConnection, req) {
    const { insumoId } = req.params;

    const verifyInsumoQuery = "SELECT elim FROM insumos WHERE did = ?";
    const verifyInsumo = await executeQuery(dbConnection, verifyInsumoQuery, [insumoId]);

    if (!verifyInsumo || verifyInsumo.length === 0) {
        throw new CustomException({
            title: "Insumo no encontrado",
            message: "El insumo con ID " + insumoId + " no existe"
        });
    }

    if (verifyInsumo[0].elim == 1) throw new CustomException({
        title: "Insumo ya eliminado",
        message: "El insumo con ID " + insumoId + " ya ha sido eliminado"
    });

    const deleteQuery = "UPDATE insumos SET elim = 1 WHERE did = ? AND superado = 0";
    await executeQuery(dbConnection, deleteQuery, [insumoId]);

    return {
        success: true,
        message: "Insumo eliminado correctamente",
        data: {
            id: insumoId
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}