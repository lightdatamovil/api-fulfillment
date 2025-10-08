import { LightdataQuerys } from "lightdata-tools";

export async function getlogisticaById(db, req) {
    const logisticaDid = req.params.logisticaDid;
    const { userId } = req.user;

    const logistica = await LightdataQuerys.select({
        dbConnection: db,
        table: "logisticas",
        column: "did",
        value: logisticaDid,
        select: "*",
        throwExceptionIfNotExists: true
    });
    console.log(logistica);

    const { nombre, codigo, codigoLD, logisticaLD, habilitado } = logistica;

    const logisticaDirecciones = await LightdataQuerys.select({
        dbConnection: db,
        table: "logisticas_direcciones",
        column: "did_logistica",
        value: logisticaDid,
        select: ["id", "CP", "calle", "pais", "localidad", "numero", "provincia", "address_line"]
    });


    //mapear direcciones a objeto direcciones
    const direcciones = logisticaDirecciones.map(d => ({
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