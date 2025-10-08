import { CustomException, executeQuery, LightdataQuerys, Status } from "lightdata-tools";
import { DbUtils } from "../../src/functions/db_utils.js";

export async function editLogistica(db, req) {
    const logisticaDid = req.params.logisticaDid;
    const { userId } = req.user ?? {};
    const { nombre, logisticaLD, codigo, codigoLD, habilitado } = req.body ?? {};

    const verifyLogistica = await DbUtils.verifyExistsAndSelect({
        db,
        table: "logisticas",
        column: "did",
        valor: logisticaDid,
        select: "nombre, codigo, codigoLD, logisticaLD, habilitado"
    });
    const { nombreActual, logisticaLDActual, codigoActual, codigoLDActual, habilitadoActual } = verifyLogistica;

    //duplicados
    const logisticaDuplicada = await executeQuery(
        db,
        `SELECT * FROM logisticas WHERE 
            (nombre = ? OR codigo = ? ) AND superado = 0 AND elim = 0
            LIMIT 1;`,
        [nombre, codigo], true
    );
    if (logisticaDuplicada?.length) {
        throw new CustomException({
            title: "Duplicado",
            message: "Ya existe un logistica activo con los mismos datos",
            status: Status.conflict,
        });
    }

    //mapear
    const topAllowed = ["nombre", "codigo", "codigoLD", "logisticaLD", "habilitado"];
    const topPatch = pickDefined(req.body, topAllowed);

    const nombreInsert = isDefined(topPatch.nombre) ? topPatch.nombre : nombreActual;
    const codigoInsert = isDefined(topPatch.codigo) ? topPatch.codigo : codigoActual;
    const codigoLDInsert = isDefined(topPatch.codigoLD) ? topPatch.codigoLD : codigoLDActual;
    const logisticaLDInsert = isDefined(topPatch.logisticaLD) ? topPatch.logisticaLD : logisticaLDActual;
    const habilitadoInsert = isDefined(topPatch.habilitado) ? topPatch.habilitado : habilitadoActual;

    await LightdataQuerys.update({
        db,
        tabla: "logisticas",
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
            db,
            tabla: "logisticas_direcciones",
            quien: userId,
            data
        });

    }
    if (hayDirecciones.hasRemove) {
        await LightdataQuerys.delete({
            db,
            tabla: "logisticas_direcciones",
            did: hayDirecciones.didsRemove,
            quien: userId,
        });
    }

    if (hayDirecciones.hasUpdate) {
        console.log("entre a direcciones update");
        const didsUpdate = hayDirecciones.update.map(d => d.id);
        const normalized = normalizeDireccionesInsert(hayDirecciones.update);

        // update sup = 1
        const sqlUpdate = `UPDATE logisticas_direcciones SET superado = 1 WHERE did_logistica = ? AND id IN (${didsUpdate.map(() => "?").join(",")})`;
        await executeQuery(db, sqlUpdate, [logisticaDid, ...didsUpdate]);

        // insert nuevo
        const cols = "(did_logistica, cp, calle, pais, localidad, numero, provincia, address_line, autofecha, quien, superado, elim)";
        const placeholders = normalized.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 0, 0)").join(", ");
        const sql = `INSERT INTO logisticas_direcciones ${cols} VALUES ${placeholders}`;

        const params = [];
        for (const d of normalized) {
            params.push(logisticaDid, d.cp, d.calle, d.pais, d.localidad, d.numero, d.provincia, d.address_line, userId
            );
        }

        const r = await executeQuery(db, sql, params);

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
    const direccionesSelect = await executeQuery(db, "SELECT id, did, cp, calle, pais, localidad, numero, provincia, address_line FROM logisticas_direcciones WHERE did_logistica = ? AND elim = 0 AND superado = 0", [logisticaDid]);

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
    const addRaw = toArray(direcciones?.add);
    const updateRaw = toArray(direcciones?.update);
    const removeRaw = toArray(direcciones?.remove);

    const hasAdd = addRaw.length > 0;
    const hasUpdate = updateRaw.length > 0;
    const hasRemove = removeRaw.length > 0;

    // Filtrar SOLO las que no estén vacías 
    const add = hasAdd ? addRaw.filter((x) => !isEmptyAddress(x)) : [];
    const update = hasUpdate ? updateRaw.filter((x) => !isEmptyAddress(x)) : [];
    const remove = hasRemove ? removeRaw.filter((x) => !isEmptyValue(x)) : [];

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

const isEmptyAddress = (obj) => {
    if (!obj || typeof obj !== "object") return true;
    return Object.values(obj).every(isEmptyValue);
};
const toArray = (v) => Array.isArray(v) ? v : [];
const isEmptyValue = (v) =>
    v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const isDefined = (v) => v !== undefined;
const pickDefined = (obj = {}, allow = null) => {
    const out = {};
    const keys = allow ?? Object.keys(obj);
    for (const k of keys) if (isDefined(obj[k])) out[k] = obj[k];
    return out;
}

const nn = (v) => (v ?? null);  