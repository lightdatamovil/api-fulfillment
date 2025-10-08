import { executeQuery, LightdataQuerys, } from "lightdata-tools";


export async function editLogistica(dbConnection, req) {
    const logisticaDid = req.params.logisticaDid;
    const { userId } = req.user ?? {};
    const { nombre, logisticaLD, codigo, codigoLD, habilitado } = req.body ?? {};

    const verifyLogistica = await LightdataQuerys.select({
        dbConnection: dbConnection,
        table: "logisticas",
        column: "did",
        value: logisticaDid,
        select: "nombre, codigo, codigoLD, logisticaLD, habilitado"
    });
    const { nombreActual, logisticaLDActual, codigoActual, codigoLDActual, habilitadoActual } = verifyLogistica;

    //mapear
    const topAllowed = ["nombre", "codigo", "codigoLD", "logisticaLD", "habilitado"];
    const topPatch = pickDefined(req.body, topAllowed);

    const nombreInsert = isDefined(topPatch.nombre) ? topPatch.nombre : nombreActual;
    const codigoInsert = isDefined(topPatch.codigo) ? topPatch.codigo : codigoActual;
    const codigoLDInsert = isDefined(topPatch.codigoLD) ? topPatch.codigoLD : codigoLDActual;
    const logisticaLDInsert = isDefined(topPatch.logisticaLD) ? topPatch.logisticaLD : logisticaLDActual;
    const habilitadoInsert = isDefined(topPatch.habilitado) ? topPatch.habilitado : habilitadoActual;

    await LightdataQuerys.update({
        dbConnection: dbConnection,
        table: "logisticas",
        did: logisticaDid,
        quien: userId,
        data: {
            codigo: codigoInsert,
            nombre: nombreInsert,
            codigoLD: codigoLDInsert,
            logisticaLD: logisticaLDInsert,
            habilitado: habilitadoInsert
        }
    });

    // logisticas_direcciones
    const { direcciones } = req.body ?? {};
    const hayDirecciones = getDireccionesOpsState(direcciones);

    if (hayDirecciones.hasAdd) {
        console.log("entre a direcciones add");

        const data = hayDirecciones.add.map(direccion => ({
            did_logistica: logisticaDid,
            cp: direccion.cp,
            calle: direccion.calle,
            pais: direccion.pais,
            localidad: direccion.localidad,
            numero: direccion.numero,
            provincia: direccion.provincia,
            address_line: direccion.address_line,
            autofecha: new Date(),
            quien: userId,
            superado: 0,
            elim: 0
        }));

        await LightdataQuerys.insert({
            dbConnection,
            table: "logisticas_direcciones",
            quien: userId,
            data
        });

    }
    if (hayDirecciones.hasRemove) {
        await LightdataQuerys.delete({
            dbConnection,
            table: "logisticas_direcciones",
            did: hayDirecciones.didsRemove,
            quien: userId,
        });
    }

    if (hayDirecciones.hasUpdate) {
        console.log("entre a direcciones update");
        const normalized = normalizeDireccionesInsert(hayDirecciones.update);
        await LightdataQuerys.update({
            dbConnection,
            table: "logisticas_direcciones",
            did: hayDirecciones.didsUpdate,
            quien: userId,
            data: normalized
        });



    }

    // select de todas las direcciones para devolver
    let direccionesReturn = [];
    const direccionesSelect = await executeQuery(dbConnection, "SELECT id, did, cp, calle, pais, localidad, numero, provincia, address_line FROM logisticas_direcciones WHERE did_logistica = ? AND elim = 0 AND superado = 0", [logisticaDid]);

    if (direccionesSelect.length > 0) {
        direccionesReturn = direccionesSelect
    }
    return {
        success: true,
        message: "logistica actualizada correctamente",
        data: {
            did: logisticaDid,
            nombre: nombre,
            logisticaLD: logisticaLD,
            codigo: codigo,
            codigoLD: codigoLD,
            quien: userId,
            habilitado: habilitado,
            direcciones: direccionesReturn

        },
        meta: { timestamp: new Date().toISOString() },
    };
}


// Helpers

function normalizeDireccionesInsert(adds) {

    const out = new Array(adds.length);
    for (let i = 0; i < adds.length; i++) {
        const d = adds[i] ?? {};
        out[i] = {
            cp: nn(d.cp),
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

    const getId = (x) => (x && (x.did ?? x.id)) ?? x ?? null;
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
const pickDefined = (obj = {}, allow = null) => {
    const out = {};
    const keys = allow ?? Object.keys(obj);
    for (const k of keys) if (isDefined(obj[k])) out[k] = obj[k];
    return out;
}

const nn = (v) => (v ?? null);  