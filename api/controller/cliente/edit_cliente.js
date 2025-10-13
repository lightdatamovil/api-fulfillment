// clientes.controller.js (ESM)
import { LightdataORM } from "lightdata-tools";

/**
 * PUT /api/clientes/:clienteId
 * Body: 
 *   root { nombre_fantasia, razon_social, codigo, observaciones, habilitado }
 *   direcciones { add[], update[], remove[] }
 *   contactos   { add[], update[], remove[] }
 *   cuentas     { add[], update[], remove[] }
 *
 * Estrategia: versionado automático con LightdataORM.update() / delete().
 * Sin transacciones.
 */
export async function editCliente(dbConnection, req) {
    const { userId } = req.user;
    const { clienteId } = req.params;
    const { direcciones, contactos, cuentas, nombre_fantasia, razon_social, codigo, observaciones, habilitado } = req.body;

    const arr = (x) => (Array.isArray(x) ? x : []);
    const dAdd = arr(direcciones?.add);
    const dUpd = arr(direcciones?.update);
    const dDel = arr(direcciones?.remove);

    const cAdd = arr(contactos?.add);
    const cUpd = arr(contactos?.update);
    const cDel = arr(contactos?.remove);

    const aAdd = arr(cuentas?.add);
    const aUpd = arr(cuentas?.update);
    const aDel = arr(cuentas?.remove);

    const [vigente] = await LightdataORM.select({
        dbConnection,
        table: "clientes",
        where: { did: clienteId },
        throwIfNotExists: true,
    });


    const updateData = {
        nombre_fantasia: nombre_fantasia ?? vigente.nombre_fantasia,
        razon_social: razon_social ?? vigente.razon_social,
        codigo: codigo ?? vigente.codigo,
        observaciones: observaciones ?? vigente.observaciones,
        habilitado: Number(habilitado ?? vigente.habilitado ?? 0),
    };

    await LightdataORM.update({
        dbConnection,
        table: "clientes",
        where: { did: Number(clienteId) },
        quien: userId,
        data: updateData,
        throwIfNotFound: true,
    });

    if (dAdd.length > 0) {
        await LightdataORM.insert({
            dbConnection,
            table: "clientes_direcciones",
            quien: userId,
            data: dAdd.map((d) => ({
                did_cliente: Number(clienteId),
                address_line: d?.address_line ?? null,
                pais: d?.pais ?? null,
                localidad: d?.localidad ?? null,
                numero: d?.numero ?? null,
                calle: d?.calle ?? null,
                cp: d?.cp ?? null,
                provincia: d?.provincia ?? null,
                titulo: d?.titulo ?? null,
            })),
        });
    }

    if (dUpd.length > 0) {
        await LightdataORM.update({
            dbConnection,
            table: "clientes_direcciones",
            where: { did: dUpd.map(d => d.did) },
            data: dUpd.map(d => ({
                address_line: d.address_line,
                pais: d.pais,
                localidad: d.localidad,
                numero: d.numero,
                calle: d.calle,
                cp: d.cp,
                provincia: d.provincia,
                titulo: d.titulo,
            })),
            quien: userId,
        });
    }


    if (dDel.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "clientes_direcciones",
            where: { did: dDel.map(d => d.did) },
            quien: userId,
        });
    }

    if (cAdd.length > 0) {
        await LightdataORM.insert({
            dbConnection,
            table: "clientes_contactos",
            quien: userId,
            data: cAdd.map((c) => ({
                did_cliente: Number(clienteId),
                tipo: Number(c?.tipo ?? 0),
                valor: c?.valor ?? null,
            })),
        });
    }

    if (cUpd.length > 0) {
        await LightdataORM.update({
            dbConnection,
            table: "clientes_contactos",
            where: { did: cUpd.map(c => c.did) },
            quien: userId,
            data: cUpd.map(c => ({
                tipo: Number(c?.tipo ?? 0),
                valor: c?.valor ?? null,
                elim: 0,
            })),
        });
    }

    if (cDel.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "clientes_contactos",
            where: { did: cDel.map(c => c.did) },
            quien: userId,
        });
    }

    if (aAdd.length > 0) {
        await LightdataORM.insert({
            dbConnection,
            table: "clientes_cuentas",
            quien: userId,
            data: aAdd.map((a) => ({
                did_cliente: Number(clienteId),
                flex: Number(a?.flex ?? 0),
                titulo: a?.titulo ?? null,
                ml_id_vendedor: String(a?.ml_id_vendedor ?? ""),
                ml_user: a?.ml_user ?? null,
                data: a?.data ?? null,
            })),
        });
    }

    if (aUpd.length > 0) {
        await LightdataORM.update({
            dbConnection,
            table: "clientes_cuentas",
            where: { did: aUpd.map(a => a.did) },
            quien: userId,
            data: aUpd.map(a => ({
                flex: Number(a?.flex ?? 0),
                titulo: a?.titulo ?? null,
                ml_id_vendedor: String(a?.ml_id_vendedor ?? ""),
                ml_user: a?.ml_user ?? null,
                data: a?.data ?? null,
                elim: 0,
            })),
        });
    }

    if (aDel.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "clientes_cuentas",
            where: { did: aDel.map(a => a.did) },
            quien: userId,
        });
    }

    return {
        success: true,
        message: "Cliente actualizado correctamente (versionado automático)",
        data: {
            did: Number(clienteId)
        },
        meta: {
            timestamp: new Date().toISOString()
        },
    };
}
