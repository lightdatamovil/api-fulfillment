import { CustomException, executeQuery, LightdataQuerys, Status } from "lightdata-tools";

export async function createlogistica(db, req) {
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
        [nombre, codigo]
    );

    if (logisticaDuplicada?.length) {
        throw new CustomException({
            title: "Duplicado",
            message: "Ya existe un logistica activo con los mismos datos",
            status: Status.conflict,
        });
    }

    const [inserted] = await LightdataQuerys.insert({
        dbConnection: db,
        table: "logisticas",
        data: { nombre, logisticaLD, codigo, codigoLD, habilitado },
        quien: userId,
    });

    if (direcciones.length > 0) {
        const data = direcciones.map(d => ({
            did_logistica: inserted,
            cp: d.cp,
            calle: d.calle,
            pais: d.pais,
            localidad: d.localidad,
            numero: d.numero,
            provincia: d.provincia,
            address_line: d.address_line
        }))
        await LightdataQuerys.insert({
            dbConnection: db,
            table: "logisticas_direcciones",
            data,
            quien: userId,
        });
    }

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
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}

