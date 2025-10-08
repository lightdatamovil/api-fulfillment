import { executeQuery } from "lightdata-tools";

export async function getlogisticaById(db, req) {
    const logisticaDid = req.params.logisticaDid;
    const { userId } = req.user;

    console.log("logisticaDid", logisticaDid);

    const logistica = await DbUtils.verifyExistsAndSelect({
        db,
        table: "logisticas",
        column: "did",
        valor: logisticaDid,
        select: "did, nombre, codigo, codigoLD, logisticaLD, habilitado"
    });

    const { nombre, codigo, codigoLD, logisticaLD, habilitado } = logistica;

    const sqlDirecciones = 'SELECT id, CP, calle, pais, localidad, numero, provincia, address_line FROM logisticas_direcciones WHERE did_logistica = ? AND elim = 0 AND superado = 0';

    const direccionesSelect = await executeQuery(db, sqlDirecciones, [logisticaDid]);

    //mapear direcciones a objeto direcciones
    const direcciones = direccionesSelect.map(d => ({
        id: d.id,
        cp: d.CP,
        calle: d.calle,
        pais: d.pais,
        localidad: d.localidad,
        numero: d.numero,
        provincia: d.provincia,
        address_line: d.address_line
    }));

    return {
        success: true,
        message: "logistica encontrada correctamente",
        data: {
            did: logisticaDid,
            nombre: nombre,
            logisticaLD: logisticaLD,
            codigo: codigo,
            codigoLD: codigoLD,
            habilitado: habilitado,
            direcciones: direcciones,
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}