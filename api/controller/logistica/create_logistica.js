import { CustomException, executeQuery, LightdataORM, Status } from "lightdata-tools";

export async function createlogistica({ db, req }) {
    const {
        nombre,
        logisticaLD,
        codigo,
        codigoLD,
        habilitado,
        direcciones
    } = req.body;

    const { userId } = req.user;

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

    const [inserted] = await LightdataORM.insert({
        db,
        table: "logisticas",
        data: { nombre, logisticaLD, codigo, codigoLD, habilitado },
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
        }))
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
            logisticaLD: logisticaLD,
            codigo: codigo,
            codigoLD: codigoLD,
            habilitado: habilitado,
            direcciones: direccionesSelect,
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}

