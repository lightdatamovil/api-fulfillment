import { CustomException, executeQuery, LightdataQuerys, } from "lightdata-tools";


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
            direccion: direccion.direccion,
            titulo: direccion.titulo,
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
        const didsUpdate = hayDirecciones.update.map(d => d.did);
        const normalized = normalizeDireccionesInsert(hayDirecciones.update);

        // update sup = 1
        const sqlUpdate = `UPDATE logisticas_direcciones SET superado = 1 WHERE did_logistica = ? AND superado = 0 AND elim = 0 AND did IN (${didsUpdate.map(() => "?").join(",")})`;
        await executeQuery(dbConnection, sqlUpdate, [logisticaDid, ...didsUpdate]);

        // insert nuevo
        const cols = "(did, did_logistica, cp, calle, pais, localidad, numero, provincia, address_line, titulo, autofecha, quien, superado, elim)";
        const placeholders = normalized.map(() => "(?,?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 0, 0)").join(", ");
        const sql = `INSERT INTO logisticas_direcciones ${cols} VALUES ${placeholders}`;

        const params = [];
        for (const d of normalized) {
            params.push(d.did, logisticaDid, d.cp, d.calle, d.pais, d.localidad, d.numero, d.provincia, d.address_line, d.titulo, userId
            );
        }

        const r = await executeQuery(dbConnection, sql, params, true);

        // 4) chequear que se insertaron todas
        if (r.affectedRows !== normalized.length) {
            throw new CustomException({
                title: "Inserción parcial",
                message: `Se insertaron ${r.affectedRows} de ${normalized.length} direcciones`,
            });
        }

    }



    // select de todas las direcciones para devolver
    let direccionesReturn = [];
    const direccionesSelect = await executeQuery(dbConnection, "SELECT did, titulo, cp, calle, pais, localidad, numero, provincia, address_line FROM logisticas_direcciones WHERE did_logistica = ? AND elim = 0 AND superado = 0", [logisticaDid], true);

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
            direcciones: direccionesSelect

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
const pickDefined = (obj = {}, allow = null) => {
    const out = {};
    const keys = allow ?? Object.keys(obj);
    for (const k of keys) if (isDefined(obj[k])) out[k] = obj[k];
    return out;
}

const nn = (v) => (v ?? null);  