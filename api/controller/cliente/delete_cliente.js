import { LightdataORM } from "lightdata-tools";

export async function deleteCliente(db, req) {
    const { clienteId } = req.params;
    const { userId } = req.user;

    await LightdataORM.delete({
        db,
        table: "clientes",
        where: { did: clienteId },
        quien: userId,
        throwIfNotFound: true,
    });

    const dirLinks = await LightdataORM.select({
        db,
        table: "clientes_direcciones",
        where: { did_cliente: clienteId },
    });

    if (dirLinks.length > 0) {
        await LightdataORM.delete({
            db,
            table: "clientes_direcciones",
            where: { did: dirLinks.map((l) => l.did) },
            quien: userId,
        });
    }

    const contLinks = await LightdataORM.select({
        db,
        table: "clientes_contactos",
        where: { did_cliente: clienteId },
    });

    if (contLinks.length > 0) {
        await LightdataORM.delete({
            db,
            table: "clientes_contactos",
            where: { did: contLinks.map((l) => l.did) },
            quien: userId,
        });
    }
    const cuentaLinks = await LightdataORM.select({
        db,
        table: "clientes_cuentas",
        where: { did_cliente: clienteId },
    });
    if (cuentaLinks.length > 0) {
        await LightdataORM.delete({
            db,
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
