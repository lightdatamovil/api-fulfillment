import { CustomException, executeQuery, LightdataORM, Status } from "lightdata-tools";

export async function createlogistica({ db, req }) {
    const {
        nombre,
        sync,
        codigo,
        codigoSync,
        habilitado,
        direcciones
    } = req.body;

    //logisticaLD pasa a ser sync  y codigoLD es codigoSync

    const { userId } = req.user;

    const q = `SELECT * FROM logisticas WHERE 
        (nombre = ? OR codigo = ? ) AND superado = 0 AND elim = 0
        LIMIT 1;`;
    const logisticaDuplicada = await executeQuery({ db, query: q, values: [nombre, codigo] });

    if (logisticaDuplicada?.length) {
        throw new CustomException({
            title: "Duplicado",
            message: "Ya existe un logistica activo con los mismos datos",
            status: Status.conflict,
        });
    }

    const [inserted] = await LightdataORM.insert({
        db,
        table: "logisticas",
        data: { nombre, sync, codigo, codigoSync, habilitado },
        quien: userId,
    });

    if (direcciones.length > 0) {
        const data = direcciones.map(d => ({
            did_logistica: inserted,
            titulo: d.titulo,
            cp: d.cp,
            calle: d.calle,
            pais: d.pais,
            localidad: d.localidad,
            numero: d.numero,
            provincia: d.provincia,
            address_line: d.address_line
        }));

        await LightdataORM.insert({
            db,
            table: "logisticas_direcciones",
            data,
            quien: userId,
        });
    }

    const direccionesSelect = await LightdataORM.select({
        db,
        table: "logisticas_direcciones",
        where: { did_logistica: inserted },
        select: ["did", "titulo", "cp", "calle", "pais", "localidad", "numero", "provincia", "address_line"],
    });

    return {
        success: true,
        message: "logistica creada correctamente",
        data: {
            did: inserted,
            nombre: nombre,
            sync: sync,
            codigo: codigo,
            codigoSync: codigoSync,
            habilitado: habilitado,
            direcciones: direccionesSelect,
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}

