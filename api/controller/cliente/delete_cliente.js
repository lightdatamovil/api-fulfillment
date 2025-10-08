import { LightdataQuerys } from "lightdata-tools";

export async function deleteCliente(dbConnection, req) {
    const { clienteId } = req.params;
    const { userId } = req.user ?? {};

    // Borra el cliente principal
    await LightdataQuerys.delete({
        dbConnection,
        table: "clientes",
        did: clienteId,
        quien: userId,
    });

    // Borra direcciones vinculadas
    const dirLinks = await LightdataQuerys.select({
        dbConnection,
        table: "clientes_direcciones",
        column: "did_cliente",
        value: clienteId,
    });
    if (dirLinks.length > 0) {
        await LightdataQuerys.delete({
            dbConnection,
            table: "clientes_direcciones",
            did: dirLinks.map((l) => l.did),
            quien: userId,
        });
    }

    // Borra contactos vinculados
    const contLinks = await LightdataQuerys.select({
        dbConnection,
        table: "clientes_contactos",
        column: "did_cliente",
        value: clienteId,
    });
    if (contLinks.length > 0) {
        await LightdataQuerys.delete({
            dbConnection,
            table: "clientes_contactos",
            did: contLinks.map((l) => l.did),
            quien: userId,
        });
    }

    // Borra cuentas vinculadas
    const cuentaLinks = await LightdataQuerys.select({
        dbConnection,
        table: "clientes_cuentas",
        column: "did_cliente",
        value: clienteId,
    });
    if (cuentaLinks.length > 0) {
        await LightdataQuerys.delete({
            dbConnection,
            table: "clientes_cuentas",
            did: cuentaLinks.map((l) => l.did),
            quien: userId,
        });
    }

    return {
        success: true,
        message: "Cliente eliminado correctamente",
        data: { did: Number(clienteId) },
        meta: { timestamp: new Date().toISOString() },
    };
}
