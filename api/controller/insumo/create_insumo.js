import { CustomException, LightdataQuerys } from "lightdata-tools";
import { DbUtils } from "../../src/functions/db_utils.js";

export async function createInsumo(dbConnection, req) {
    const { codigo, clientes_dids, habilitado, nombre, unidad } = req.body;
    const { userId } = req.user;

    const clientesArr = new Set(clientes_dids.map(n => Number(n)));

    const dup = await DbUtils.existsInDb(dbConnection, "insumos", "codigo", codigo);

    if (dup) {
        throw new CustomException({
            title: "Insumo existente",
            message: "Ya existe un insumo con ese código.",
        });
    }

    const [newId] = await LightdataQuerys.insert({
        dbConnection,
        tabla: "insumos",
        quien: userId,
        data: { codigo, nombre, unidad, habilitado },
    });

    if (clientesArr.length > 0) {
        const data = clientesArr.map(clientDid => ({
            did_insumo: newId,
            did_cliente: clientDid
        }));

        await LightdataQuerys.insert({
            dbConnection,
            tabla: "insumos_clientes",
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
