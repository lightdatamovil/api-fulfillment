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
export async function editCliente(db, req) {
    const { userId } = req.user;
    const { clienteId } = req.params;
    const { direcciones, contactos, cuentas, nombre_fantasia, razon_social, codigo, observaciones, habilitado } = req.body;

    const dAdd = direcciones?.add;
    const dUpd = direcciones?.update;
    const dDel = direcciones?.remove;

    const cAdd = contactos?.add;
    const cUpd = contactos?.update;
    const cDel = contactos?.remove;

    const aAdd = cuentas?.add;
    const aUpd = cuentas?.update;
    const aDel = cuentas?.remove;

    const [vigente] = await LightdataORM.select({
        db,
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
        db,
        table: "clientes",

        where: { did: Number(clienteId) },
        quien: userId,
        data: updateData,
        throwIfNotFound: true,
    });

    if (dAdd.length > 0) {
        const direccionesAdd = dAdd.map((d) => ({
            did_cliente: Number(clienteId),
            address_line: d?.address_line ?? null,
            pais: d?.pais ?? null,
            localidad: d?.localidad ?? null,
            numero: d?.numero ?? null,
            calle: d?.calle ?? null,
            cp: d?.cp ?? null,
            provincia: d?.provincia ?? null,
            titulo: d?.titulo ?? null,
        }));
        await LightdataORM.insert({
            db,
            table: "clientes_direcciones",
            quien: userId,
            data: direccionesAdd,
        });
    }

    if (dUpd.length > 0) {
        await LightdataORM.update({
            db,
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
            db,
            table: "clientes_direcciones",
            where: { did: dDel },
            quien: userId,
        });
    }

    if (cAdd.length > 0) {
        const contactosAdd = cAdd.map((c) => ({
            did_cliente: Number(clienteId),
            tipo: Number(c?.tipo ?? 0),
            valor: c?.valor ?? null,
        }));
        await LightdataORM.insert({
            db,
            table: "clientes_contactos",
            quien: userId,
            data: contactosAdd,
        });
    }

    if (cUpd.length > 0) {
        await LightdataORM.update({
            db,
            table: "clientes_contactos",
            where: { did: cUpd.map(c => c.did) },
            quien: userId,
            data: cUpd.map(c => ({
                tipo: c.tipo,
                valor: c.valor,
            })),
        });
    }

    if (cDel.length > 0) {
        await LightdataORM.delete({
            db,
            table: "clientes_contactos",
            where: { did: cDel },
            quien: userId,
        });
    }

    if (aAdd.length > 0) {
        const cuentasAdd = aAdd.map((a) => ({
            did_cliente: Number(clienteId),
            flex: Number(a?.flex ?? 0),
            titulo: a?.titulo ?? null,
            ml_id_vendedor: String(a?.ml_id_vendedor ?? ""),
            ml_user: a?.ml_user ?? null,
            data: JSON.stringify(a.data ?? null),
        }));

        await LightdataORM.insert({
            db,
            table: "clientes_cuentas",
            quien: userId,
            data: cuentasAdd,
        });
    }

    if (aUpd.length > 0) {
        const cuentas = aUpd.map(a => ({
            flex: a.flex,
            titulo: a.titulo,
            ml_id_vendedor: a.ml_id_vendedor,
            ml_user: a.ml_user,
            data: JSON.stringify(a.data),
        }));

        await LightdataORM.update({
            db,
            table: "clientes_cuentas",
            where: { did: aUpd.map(a => a.did) },
            quien: userId,
            data: cuentas,
        });
    }

    if (aDel.length > 0) {
        await LightdataORM.delete({
            db,
            table: "clientes_cuentas",
            where: { did: aDel },
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
