import { isNonEmpty, isDefined, LightdataORM, } from "lightdata-tools";

export async function createCliente(dbConnection, req) {
    const {
        nombre_fantasia,
        razon_social,
        codigo,
        habilitado,
        observaciones = [],
        direcciones = [],
        contactos = [],
        cuentas = [],
        depositos = [],
    } = req.body;
    const { userId } = req.user;

    const nf = String(nombre_fantasia || "").trim();
    const rs = isNonEmpty(razon_social) ? String(razon_social).trim() : null;
    const cod = isNonEmpty(codigo) ? String(codigo).trim() : null;
    const obs = isNonEmpty(observaciones) ? String(observaciones).trim() : null;
    const vl = isDefined(habilitado) ? String(habilitado).trim() : null;

    await LightdataORM.select({
        dbConnection,
        table: "clientes",
        where: { nombre_fantasia: nf, codigo: cod },
        throwIfExists: true,
    });

    const [clienteId] = await LightdataORM.insert({
        dbConnection,
        table: "clientes",
        quien: userId,
        data: {
            nombre_fantasia: nf,
            razon_social: rs,
            codigo: cod,
            habilitado: vl,
            observaciones: obs,
        },
    });

    if (direcciones.length > 0) {
        const data = direcciones.map((d) => ({
            did_cliente: clienteId,
            pais: isNonEmpty(d?.pais) ? String(d.pais).trim() : null,
            localidad: isNonEmpty(d?.localidad) ? String(d.localidad).trim() : null,
            calle: isNonEmpty(d?.calle) ? String(d.calle).trim() : null,
            numero: isNonEmpty(d?.numero) ? String(d.numero).trim() : null,
            cp: isNonEmpty(d?.cp) ? String(d.cp).trim() : null,
            provincia: isNonEmpty(d?.provincia) ? String(d.provincia).trim() : null,
        }));

        await LightdataORM.insert({
            dbConnection,
            table: "clientes_direcciones",
            quien: userId,
            data,
        });
    }

    if (contactos.length > 0) {
        const data = contactos.map((c) => ({
            did_cliente: clienteId,
            tipo: c?.tipo ?? 0,
            valor: c?.valor ?? null,
        }));

        await LightdataORM.insert({
            dbConnection,
            table: "clientes_contactos",
            quien: userId,
            data,
        });
    }

    if (cuentas.length > 0) {
        const cuentasData = cuentas.map((c) => {
            const flex = Number(c?.flex ?? c?.tipo) || 0;
            const rawData = c?.data ?? {};
            const dataStr = JSON.stringify(rawData);
            const titulo = (c?.titulo ?? "").toString();
            const ml_id_vendedor =
                flex === 1
                    ? (rawData?.ml_id_vendedor ?? c?.ml_id_vendedor ?? "").toString()
                    : "";
            const ml_user =
                flex === 1
                    ? (rawData?.ml_user ?? c?.ml_user ?? "").toString()
                    : "";

            return {
                did_cliente: clienteId,
                flex,
                data: dataStr,
                titulo,
                ml_id_vendedor,
                ml_user,
            };
        });
        const cuentasIds = await LightdataORM.insert({
            dbConnection,
            table: "clientes_cuentas",
            quien: userId,
            data: cuentasData,
        });

        if (depositos.length > 0) {
            const depositosData = cuentasIds.flatMap((ctaId) =>
                depositos.map((d) => ({
                    did_cliente_cuenta: ctaId,
                    did_deposito: Number(d?.did_deposito) || 0,
                }))
            );

            if (depositosData.length > 0) {
                await LightdataORM.insert({
                    dbConnection,
                    table: "clientes_cuentas_depositos",
                    quien: userId,
                    data: depositosData,
                });
            }
        }
    }

    return {
        success: true,
        message: "Cliente creado correctamente",
        data: {
            id: clienteId,
            did: clienteId,
            nombre_fantasia: nf,
            razon_social: rs,
            codigo: cod,
            habilitado: vl,
            observaciones: obs,
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
