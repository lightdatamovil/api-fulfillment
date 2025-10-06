import { CustomException, executeQuery } from "lightdata-tools";
import { DbUtils } from "../../src/functions/db_utils.js";

export async function editLogistica(db, req) {
    const logisticaDid = req.params.logisticaDid;
    const { userId } = req.user ?? {};

    //EXISTE?
    const verifyLogistica = await DbUtils.verifyExistsAndSelect({
        db,
        table: "logisticas",
        column: "did",
        valor: logisticaDid,
        select: "nombre, codigo, codigoLD, logisticaLD, habilitado"
    });

    const { nombreActual, esLightdataActual, codigoActual, codigoLDActual, habilitadoActual } = verifyLogistica;

    //mapear
    const topAllowed = ["nombre", "codigo", "codigoLD", "esLightdata", "habilitado"];
    const topPatch = pickDefined(req.body, topAllowed);

    // Mapear nombres de body -> columnas reales
    const updateTop = {
        ...(isDefined(topPatch.nombre) ? { nombre: topPatch.nombre } : {}),
        ...(isDefined(topPatch.codigo) ? { codigo: topPatch.codigo } : {}),
        ...(isDefined(topPatch.codigoLD) ? { codigoLD: topPatch.codigoLD } : {}),
        ...(isDefined(topPatch.esLightdata) ? { logisticaLD: topPatch.esLightdata } : {}),
        ...(isDefined(topPatch.habilitado) ? { habilitado: topPatch.habilitado } : {}),
    };

    const nombreInsert = isDefined(topPatch.nombre) ? topPatch.nombre : nombreActual;
    const codigoInsert = isDefined(topPatch.codigo) ? topPatch.codigo : codigoActual;
    const codigoLDInsert = isDefined(topPatch.codigoLD) ? topPatch.codigoLD : codigoLDActual;
    const esLightdataInsert = isDefined(topPatch.esLightdata) ? topPatch.esLightdata : esLightdataActual;
    const habilitadoInsert = isDefined(topPatch.habilitado) ? topPatch.habilitado : habilitadoActual;

    const huboCambio = nombreInsert !== nombreActual || codigoInsert !== codigoActual || codigoLDInsert !== codigoLDActual || esLightdataInsert !== esLightdataActual || habilitadoInsert !== habilitadoActual;


    // si varables actual != variables nuevas

    if (huboCambio) {

        //SUPERADO = 1
        await executeQuery(db, "UPDATE logisticas SET superado = 1 WHERE did = ? AND superado = 0 AND elim = 0", [logisticaDid], true);

        // updateo inserto 
        const queryUpddate = `INSERT INTO logisticas (did, nombre, logisticaLD, codigo, codigoLD, habilitado,  autofecha, quien, superado, elim)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, 0, 0)`;
        const insertUpdate = await executeQuery(db, queryUpddate, [logisticaDid, nombreInsert, esLightdataInsert, codigoInsert, codigoLDInsert, habilitadoInsert, userId], true);

        if (insertUpdate.affectedRows !== 1) {
            throw new CustomException({
                title: "Error al actualizar logistica",
                message: "No se pudo actualizar el logistica",
            });
        }
    }


    // Direcciones -> add y delete

    // lo mismo en logisticas_direcciones
    const { direcciones } = req.body ?? {};
    const hayDirecciones = getDireccionesOpsState(direcciones);

    if (hayDirecciones.hasAdd) {
        console.log("entre a direcciones add");

        const normalized = normalizeDireccionesInsert(hayDirecciones.add);
        console.log("normalized", normalized);

        const cols = "(did_logistica, cp, calle, pais, localidad, numero, provincia, address_line, autofecha, quien, superado, elim)";
        const placeholders = normalized.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 0, 0)").join(", ");
        const sql = `INSERT INTO logisticas_direcciones ${cols} VALUES ${placeholders}`;

        const params = [];
        for (const d of normalized) {
            params.push(logisticaDid, d.cp, d.calle, d.pais, d.localidad, d.numero, d.provincia, d.address_line, userId
            );
        }

        const r = await executeQuery(db, sql, params, true);

        // 4) chequear que se insertaron todas
        if (r.affectedRows !== normalized.length) {
            throw new CustomException({
                title: "Inserción parcial",
                message: `Se insertaron ${r.affectedRows} de ${normalized.length} direcciones`,
            });
        }

        // 8) Respuesta

    }
    if (hayDirecciones.hasRemove) {
        console.log("entre a direcciones remove");
        const idsRemove = hayDirecciones.remove;

        if (idsRemove.length > 0) {
            const sql = `UPDATE logisticas_direcciones
        SET elim = 1 WHERE did_logistica = ?
        AND id IN (${idsRemove.map(() => "?").join(",")})
        AND superado = 0
        AND elim = 0 `;
            await executeQuery(db, sql, [logisticaDid, ...idsRemove]);
        }
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

        const r = await executeQuery(db, sql, params, true);

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
    const direccionesSelect = await executeQuery(db, "SELECT id, did, cp, calle, pais, localidad, numero, provincia, address_line FROM logisticas_direcciones WHERE did_logistica = ? AND elim = 0 AND superado = 0", [logisticaDid], true);

    if (direccionesSelect.length > 0) {
        direccionesReturn = direccionesSelect
    }
    return {
        success: true,
        message: "logistica actualizada correctamente",
        data: {
            did: logisticaDid,
            nombre: nombreInsert,
            esLightdata: esLightdataInsert,
            codigo: codigoInsert,
            codigoLD: codigoLDInsert,
            quien: userId,
            habilitado: habilitadoInsert,
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

    // Filtrar entradas vacías
    const add = addRaw.filter((x) => !isEmptyAddress(x));
    const update = updateRaw.filter((x) => !isEmptyAddress(x));

    // Para remove, si envías IDs o claves, filtrá valores vacíos
    const remove = removeRaw.filter((x) => !isEmptyValue(x));

    const counts = {
        add: add.length,
        update: update.length,
        remove: remove.length,
    };

    const flags = {
        hasAdd: counts.add > 0,
        hasUpdate: counts.update > 0,
        hasRemove: counts.remove > 0,
    };

    return { add, update, remove, counts, ...flags, hasWork: flags.hasAdd || flags.hasUpdate || flags.hasRemove };
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