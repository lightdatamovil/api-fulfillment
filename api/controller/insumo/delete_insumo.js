import { LightdataORM } from "lightdata-tools";


export async function deleteInsumo(db, req) {
    const { insumoId } = req.params;
    const { userId } = req.user;

    await LightdataORM.delete({
        db,
        table: "insumos",
        where: { did: insumoId },
        quien: userId
    });

    const links = await LightdataORM.select({
        db,
        table: "insumos_clientes",
        where: { did_insumo: insumoId },
    });

    await LightdataORM.delete({
        db,
        table: "insumos_clientes",
        where: { did: links.map(l => l.did) },
        quien: userId
    });

    return {
        success: true,
        message: "Insumo eliminado correctamente",
        data: { did: insumoId },
        meta: { timestamp: new Date().toISOString() },
    };
}
