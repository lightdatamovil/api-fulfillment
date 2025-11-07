import { LightdataORM } from "lightdata-tools";

export async function getlogisticaById({ db, req }) {
    const logisticaDid = req.params.logisticaDid;
    const { userId } = req.user;

    const logistica = await LightdataORM.select({
        db,
        table: "logisticas",
        where: { did: logisticaDid },
        select: ["nombre", "codigo", "codigoSync", "sync", "habilitado"],
        throwIfNotExists: true,
        log: true,
    });

    const { nombre, codigo, codigoSync, sync, habilitado } = logistica[0];

    const logisticaDirecciones = await LightdataORM.select({
        db,
        table: "logisticas_direcciones",
        where: { did_logistica: logisticaDid },
        select: ["did", "titulo", "cp", "calle", "localidad", "numero", "provincia"]
    });

    const direcciones = logisticaDirecciones.map(d => ({
        did: d.did,
        titulo: d.titulo,
        cp: d.cp,
        calle: d.calle,
        localidad: d.localidad,
        numero: d.numero,
        provincia: d.provincia,

    }));

    return {
        success: true,
        message: "logistica encontrada correctamente",
        data: {
            did: logisticaDid,
            nombre: nombre,
            sync: sync,
            codigo: codigo,
            codigoSync: codigoSync,
            habilitado: habilitado,
            direcciones: direcciones,
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}