import { LightdataORM } from "lightdata-tools";

export async function getInsumosById({ db, req }) {
    const { insumoId } = req.params;

    const insumos = await LightdataORM.select({
        db,
        table: "insumos",
        where: {
            did: insumoId,
        },
        select: ["did", "codigo", "nombre", "unidad", "habilitado"],
        throwIfNotExists: true
    });

    const clientesRows = await LightdataORM.select({
        db,
        table: "insumos_clientes",
        where: {
            did_insumo: insumoId
        },
        select: ["did_cliente"],
    });

    const clientes_dids = clientesRows.map(r => r.did_cliente);

    return {
        success: true,
        message: "Insumo obtenido correctamente",
        data: { insumos, clientes_dids },
        meta: { timestamp: new Date().toISOString() },
    };
}
