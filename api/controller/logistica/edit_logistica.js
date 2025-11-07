import { LightdataORM } from "lightdata-tools";

export async function editLogistica({ db, req }) {
    const logisticaDid = req.params.logisticaDid;
    const { userId } = req.user ?? {};
    const { nombre, sync, codigo, codigoSync, habilitado, direcciones } = req.body ?? {};

    const verifyLogistica = await LightdataORM.select({
        db,
        table: "logisticas",
        where: { did: logisticaDid },
        throwIfNotExists: true,
    });

    const nombreInsert = isDefined(nombre) ? nombre : verifyLogistica.nombre;
    const codigoInsert = isDefined(codigo) ? codigo : verifyLogistica.codigo;
    const codigoSyncInsert = isDefined(codigoSync) ? codigoSync : verifyLogistica.codigoSync;
    const syncInsert = isDefined(sync) ? sync : verifyLogistica.sync;
    const habilitadoInsert = isDefined(habilitado) ? habilitado : verifyLogistica.habilitado;

    await LightdataORM.update({
        db,
        table: "logisticas",
        where: { did: logisticaDid },
        quien: userId,
        data: {
            codigo: codigoInsert,
            nombre: nombreInsert,
            codigoSync: codigoSyncInsert,
            sync: syncInsert,
            habilitado: habilitadoInsert
        }
    });

    const hayDirecciones = getDireccionesOpsState(direcciones);

    if (hayDirecciones.hasAdd) {
        const data = hayDirecciones.add.map(direccion => ({
            did_logistica: logisticaDid,
            titulo: direccion.titulo,
            cp: direccion.cp,
            calle: direccion.calle,
            pais: direccion.pais,
            localidad: direccion.localidad,
            numero: direccion.numero,
            provincia: direccion.provincia,
            address_line: direccion.address_line
        }));

        await LightdataORM.insert({
            db,
            table: "logisticas_direcciones",
            quien: userId,
            data
        });
    }

    if (hayDirecciones.hasRemove) {
        await LightdataORM.delete({
            db,
            table: "logisticas_direcciones",
            where: { did: hayDirecciones.didsRemove },
            quien: userId,
        });
    }

    if (hayDirecciones.hasUpdate) {
        const didsUpdate = hayDirecciones.update.map(d => d.did);
        const normalized = normalizeDireccionesInsert(hayDirecciones.update);

        await LightdataORM.update({
            db,
            table: "logisticas_direcciones",
            where: { did: didsUpdate },
            quien: userId,
            data: normalized
        });
    }

    const direccionesSelect = await LightdataORM.select({
        db,
        table: "logisticas_direcciones",
        where: { did_logistica: logisticaDid },
    });

    return {
        success: true,
        message: "logistica actualizada correctamente",
        data: {
            did: logisticaDid,
            nombre: nombre,
            sync: sync,
            codigo: codigo,
            codigoSync: codigoSync,
            quien: userId,
            habilitado: habilitado,
            direcciones: direccionesSelect

        },
        meta: { timestamp: new Date().toISOString() },
    };
}

function normalizeDireccionesInsert(adds) {

    const out = new Array(adds.length);
    for (let i = 0; i < adds.length; i++) {
        const d = adds[i] ?? {};
        out[i] = {
            did: nn(d.did),
            cp: nn(d.cp),
            titulo: nn(d.titulo),
            calle: nn(d.calle),
            pais: nn(d.pais),
            localidad: nn(d.localidad),
            numero: nn(d.numero),
            provincia: nn(d.provincia),
            address_line: nn(d.address_line),
        };
    }
    return out;
}

function getDireccionesOpsState(direcciones) {
    const add = toArray(direcciones?.add);
    const update = toArray(direcciones?.update);
    const remove = toArray(direcciones?.remove);

    const hasAdd = add.length > 0;
    const hasUpdate = update.length > 0;
    const hasRemove = remove.length > 0;

    const getId = (x) => (x && (x.did ?? x.did)) ?? x ?? null;
    const isValidId = (v) => v !== null && v !== undefined && v !== '';

    const didsUpdate = hasUpdate ? update.map(getId).filter(isValidId) : [];
    const didsRemove = hasRemove ? remove.map(getId).filter(isValidId) : [];

    return {
        hasAdd,
        hasUpdate,
        hasRemove,
        add,
        update,
        remove,
        didsUpdate,
        didsRemove,
    };
}

const toArray = (v) => Array.isArray(v) ? v : [];
const isDefined = (v) => v !== undefined;
const nn = (v) => (v ?? null);  