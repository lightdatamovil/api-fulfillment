import { LightdataORM } from "lightdata-tools";

export async function deleteCliente(dbConnection, req) {
    const { clienteId } = req.params;
    const { userId } = req.user;

    await LightdataORM.delete({
        dbConnection,
        table: "clientes",
        where: { did: clienteId },
        quien: userId,
    });

    const dirLinks = await LightdataORM.select({
        dbConnection,
        table: "clientes_direcciones",
        where: { did_cliente: clienteId },
    });

    if (dirLinks.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "clientes_direcciones",
            where: { did: dirLinks.map((l) => l.did) },
            quien: userId,
        });
    }

    const contLinks = await LightdataORM.select({
        dbConnection,
        table: "clientes_contactos",
        where: { did_cliente: clienteId },
    });

    if (contLinks.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "clientes_contactos",
            where: { did: contLinks.map((l) => l.did) },
            quien: userId,
        });
    }
    const cuentaLinks = await LightdataORM.select({
        dbConnection,
        table: "clientes_cuentas",
        where: { did_cliente: clienteId },
    });
    if (cuentaLinks.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "clientes_cuentas",
            where: { did: cuentaLinks.map((l) => l.did) },
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
