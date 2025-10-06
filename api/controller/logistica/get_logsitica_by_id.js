import { DbUtils } from "../../src/functions/db_utils.js";

export async function getlogisticaById(db, req) {
    const logisticaDid = req.params.logisticaDid;
    const { userId } = req.user;

    console.log("logisticaDid", logisticaDid);

    const logistica = await DbUtils.verifyExistsAndSelect({
        db,
        table: "logisticas",
        column: "did",
        valor: logisticaDid,
        select: "did, nombre, codigo, codigoLD, logisticaLD"
    });

    const { nombre, codigo, codigoLD, logisticaLD } = logistica;

    const direcciones = await DbUtils.verifyExistsAndSelect(
        {
            db,
            table: "logisticas_direcciones",
            column: "did_logistica",
            valor: logisticaDid,
            select: "cp, calle, pais, localidad, numero, provincia, address_line"
        });

    const { cp, calle, pais, localidad, numero, provincia, address_line } = direcciones;

    return {
        success: true,
        message: "logistica encontrada correctamente",
        data: {
            did: logisticaDid,
            nombre: nombre,
            logisticaLD: logisticaLD,
            codigo: codigo,
            codigoLD: codigoLD,
            direcciones: {
                cp: cp,
                calle: calle,
                pais: pais,
                localidad: localidad,
                numero: numero,
                provincia: provincia,
                address_line: address_line
            },
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}