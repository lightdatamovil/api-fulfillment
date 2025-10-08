import { CustomException, Status, isNonEmpty, isDefined, number01, executeQuery } from "lightdata-tools";
import { LightdataQuerys } from "../db_functions/lightdata_querys/lightdata_querys.js";

/**
 * Alta de cliente y derivados (direcciones, contactos, cuentas).
 * Usa LightdataQuerys.insert() para todas las inserciones.
 */
export async function createCliente(dbConnection, req) {
    const {
        nombre_fantasia,
        razon_social,
        codigo,
        habilitado,
        observaciones,
        direcciones,
        contactos,
        cuentas,
        depositos
    } = req.body || {};
    const { userId } = req.user ?? {};

    // ---------- Validaciones básicas ----------
    const nf = String(nombre_fantasia).trim();
    const rs = isNonEmpty(razon_social) ? String(razon_social).trim() : null;
    const cod = isNonEmpty(codigo) ? String(codigo).trim() : null;
    const obs = isNonEmpty(observaciones) ? String(observaciones).trim() : null;

    let habValue = 1;
    if (isDefined(habilitado)) {
        const h = number01(habilitado);
        if (h !== 0 && h !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "habilitado debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        habValue = h;
    }

    // ---------- Duplicados ----------
    const dupNF = await executeQuery(
        dbConnection,
        `SELECT did FROM clientes WHERE nombre_fantasia = ? AND superado = 0 AND elim = 0 LIMIT 1`,
        [nf]
    );
    if (dupNF?.length) {
        throw new CustomException({
            title: "Duplicado",
            message: `Ya existe un cliente activo con nombre_fantasia "${nf}"`,
            status: Status.conflict,
        });
    }

    if (cod) {
        const dupCod = await executeQuery(
            dbConnection,
            `SELECT did FROM clientes WHERE codigo = ? AND superado = 0 AND elim = 0 LIMIT 1`,
            [cod]
        );
        if (dupCod?.length) {
            throw new CustomException({
                title: "Duplicado",
                message: `Ya existe un cliente activo con código "${cod}"`,
                status: Status.conflict,
            });
        }
    }

    // ---------- Insert cliente ----------
    const [clienteId] = await LightdataQuerys.insert({
        dbConnection,
        tabla: "clientes",
        quien: userId,
        data: {
            nombre_fantasia: nf,
            razon_social: rs,
            codigo: cod,
            habilitado: habValue,
            observaciones: obs
        },
    });

    // ---------- Direcciones ----------
    let insertedDirecciones = [];
    if (Array.isArray(direcciones) && direcciones.length > 0) {
        const data = direcciones.map(d => ({
            did_cliente: clienteId,
            pais: isNonEmpty(d?.pais) ? String(d.pais).trim() : null,
            localidad: isNonEmpty(d?.localidad) ? String(d.localidad).trim() : null,
            calle: isNonEmpty(d?.calle) ? String(d.calle).trim() : null,
            numero: isNonEmpty(d?.numero) ? String(d.numero).trim() : null,
            cp: isNonEmpty(d?.cp) ? String(d.cp).trim() : null,
            provincia: isNonEmpty(d?.provincia) ? String(d.provincia).trim() : null,
        }));

        const dirIds = await LightdataQuerys.insert({
            dbConnection,
            tabla: "clientes_direcciones",
            quien: userId,
            data,
        });

        insertedDirecciones = data.map((d, i) => ({
            id: dirIds[i],
            did: dirIds[i],
            ...d,
            quien: userId,
        }));
    }

    // ---------- Contactos ----------
    let insertedContactos = [];
    if (Array.isArray(contactos) && contactos.length > 0) {
        const data = contactos.map(c => ({
            did_cliente: clienteId,
            tipo: c.tipo ?? 0,
            valor: c.valor ?? null,
        }));

        const contIds = await LightdataQuerys.insert({
            dbConnection,
            tabla: "clientes_contactos",
            quien: userId,
            data,
        });

        insertedContactos = data.map((c, i) => ({
            id: contIds[i],
            did: contIds[i],
            ...c,
            quien: userId,
        }));
    }

    // ---------- Cuentas ----------
    let insertedCuentas = [];
    if (Array.isArray(cuentas) && cuentas.length > 0) {
        for (const c of cuentas) {
            const flex = Number(c?.flex ?? c?.tipo) || 0;
            const rawData = c?.data ?? {};
            const dataStr = JSON.stringify(rawData);
            const titulo = (c?.titulo ?? "").toString();
            const ml_id_vendedor = flex === 1 ? (rawData?.ml_id_vendedor ?? c?.ml_id_vendedor ?? "").toString() : "";
            const ml_user = flex === 1 ? (rawData?.ml_user ?? c?.ml_user ?? "").toString() : "";

            const [ctaId] = await LightdataQuerys.insert({
                dbConnection,
                tabla: "clientes_cuentas",
                quien: userId,
                data: {
                    did_cliente: clienteId,
                    flex,
                    data: dataStr,
                    titulo,
                    ml_id_vendedor,
                    ml_user,
                },
            });

            insertedCuentas.push({
                id: ctaId,
                did: ctaId,
                did_cliente: clienteId,
                flex,
                data: rawData,
                titulo,
                ml_id_vendedor,
                ml_user,
            });

            // ---------- Depósitos por cuenta ----------
            if (Array.isArray(depositos) && depositos.length > 0) {
                const data = depositos.map(d => ({
                    did_cliente_cuenta: ctaId,
                    did_deposito: Number(d?.did_deposito) || 0,
                }));

                await LightdataQuerys.insert({
                    dbConnection,
                    tabla: "clientes_cuentas_depositos",
                    quien: userId,
                    data,
                });
            }
        }
    }

    // ---------- Respuesta ----------
    return {
        success: true,
        message: "Cliente creado correctamente",
        data: {
            id: clienteId,
            did: clienteId,
            nombre_fantasia: nf,
            razon_social: rs,
            codigo: cod,
            habilitado: habValue,
            observaciones: obs,
            direcciones: insertedDirecciones,
            contactos: insertedContactos,
            cuentas: insertedCuentas,
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
