import { LightdataQuerys } from "lightdata-tools";


export async function deleteInsumo(dbConnection, req) {
    const { insumoId } = req.params;
    const { userId } = req.user;

    await LightdataQuerys.delete({
        dbConnection,
        table: "insumos",
        did: insumoId,
        quien: userId
    });

    const links = await LightdataQuerys.select({
        dbConnection,
        table: "insumos_clientes",
        column: "did_insumo",
        value: insumoId,
    });

    await LightdataQuerys.delete({
        dbConnection,
        table: "insumos_clientes",
        did: links.map(l => l.did),
        quien: userId
    });

    return {
        success: true,
        message: "Insumo eliminado correctamente",
        data: { did: insumoId },
        meta: { timestamp: new Date().toISOString() },
    };
}
