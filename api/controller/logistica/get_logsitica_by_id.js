import { LightdataORM } from "lightdata-tools";

export async function getlogisticaById(db, req) {
    const logisticaDid = req.params.logisticaDid;
    const { userId } = req.user;

    const logistica = await LightdataORM.select({
        dbConnection: db,
        table: "logisticas",
        where: { did: logisticaDid },
        select: ["nombre", "codigo", "codigoLD", "logisticaLD", "habilitado"],
        throwExceptionIfNotExists: true
    });

    const { nombre, codigo, codigoLD, logisticaLD, habilitado } = logistica[0];

    const logisticaDirecciones = await LightdataORM.select({
        dbConnection: db,
        table: "logisticas_direcciones",
        where: { did_logistica: logisticaDid },
        select: ["did", "titulo", "cp", "calle", "pais", "localidad", "numero", "provincia", "address_line"]
    });

    const direcciones = logisticaDirecciones.map(d => ({
        did: d.did,
        titulo: d.titulo,
        cp: d.cp,
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