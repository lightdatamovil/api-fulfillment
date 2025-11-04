import { LightdataORM } from "lightdata-tools";

export async function createInsumo(db, req) {
    const { codigo, clientes_dids, habilitado, nombre, unidad } = req.body;
    const { userId } = req.user;

    const clientesArr = Array.from(new Set(clientes_dids.map(n => Number(n))));

    await LightdataORM.select({
        db,
        table: "insumos",
        where: { codigo },
        throwIfExists: true,
    });

    const [newId] = await LightdataORM.insert({
        db,
        table: "insumos",
        data: { codigo, nombre, unidad, habilitado },
        quien: userId,
    });

    if (clientesArr.length > 0) {
        const data = clientesArr.map(clientDid => ({
            did_insumo: newId,
            did_cliente: clientDid
        }));
        await LightdataORM.insert({
            db,
            table: "insumos_clientes",
            quien: userId,
            data
        });
    }

    return {
        success: true,
        message: "Insumo creado correctamente",
        data: {
            did: newId,
            codigo,
            nombre,
            unidad,
            habilitado,
            clientes_dids: Array.from(clientesArr)
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
