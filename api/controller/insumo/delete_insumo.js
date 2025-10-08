import { LightdataQuerys } from "lightdata-tools";
import { DbUtils } from "../../src/functions/db_utils";


export async function deleteInsumo(dbConnection, req) {
    const { insumoId } = req.params;
    const { userId } = req.user;

    await LightdataQuerys.delete({
        dbConnection,
        tabla: "insumos",
        did: insumoId,
        quien: userId
    });

    const links = await DbUtils.verifyExistsAndSelect({
        db: dbConnection,
        table: "insumos_clientes",
        column: "did_insumo",
        valor: insumoId,
        select: "did"
    });

    await LightdataQuerys.delete({
        dbConnection,
        tabla: "insumos_clientes",
        did: links,
        quien: userId
    });

    return {
        success: true,
        message: "Insumo eliminado correctamente",
        data: { did: insumoId },
        meta: { timestamp: new Date().toISOString() },
    };
}
