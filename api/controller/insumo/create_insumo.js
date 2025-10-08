import { LightdataQuerys } from "lightdata-tools";

export async function createInsumo(dbConnection, req) {
    const { codigo, clientes_dids, habilitado, nombre, unidad } = req.body;
    const { userId } = req.user;

    const clientesArr = Array.from(new Set(clientes_dids.map(n => Number(n))));


    await LightdataQuerys.select({
        dbConnection,
        table: "insumos",
        column: "codigo",
        value: codigo,
        throwExceptionIfAlreadyExists: true,
    });

    const [newId] = await LightdataQuerys.insert({
        dbConnection,
        table: "insumos",
        data: { codigo, nombre, unidad, habilitado },
        quien: userId,
    });

    if (clientesArr.length > 0) {
        const data = clientesArr.map(clientDid => ({
            did_insumo: newId,
            did_cliente: clientDid
        }));
        await LightdataQuerys.insert({
            dbConnection,
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
