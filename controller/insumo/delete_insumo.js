import { CustomException, executeQuery } from "lightdata-tools"

export async function deleteInsumo(dbConnection, req) {
    const { insumoId } = req.params;

    const verifyInsumoQuery = "SELECT elim FROM insumos WHERE did = ?"
    const verifyInsumo = await executeQuery(dbConnection, verifyInsumoQuery, [insumoId])

    if (!verifyInsumo[0].elim) throw new CustomException

    if (verifyInsumo[0].elim == 1) return {
        estado: false,
        message: "Insumo ya eliminado"
    }


    const deleteQuery = "UPDATE insumos SET elim = 1 WHERE did = ? AND superado = 0"
    await executeQuery(dbConnection, deleteQuery, [insumoId])

    return {
        estado: true,
        message: "Insumo eliminado correctamente.",
    }
}