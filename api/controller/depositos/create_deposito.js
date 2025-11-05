import { CustomException, Status, isNonEmpty, toStr, LightdataORM } from "lightdata-tools";

export async function createDeposito({ db, req }) {
    const { direccion, descripcion, codigo, email, telefono } = req.body || {};
    const { userId } = req.user || {};

    const direccionTrim = isNonEmpty(direccion) ? String(direccion).trim() : "";

    if (!isNonEmpty(direccionTrim)) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Se requiere 'direccion' para crear el depósito",
            status: Status.badRequest,
        });
    }

    if (isNonEmpty(codigo)) {
        await LightdataORM.select({
            db,
            table: "depositos",
            where: { codigo: String(codigo).trim() },
            throwIfExists: true,
            throwIfExistsMessage: "Ya existe un depósito con ese código.",
        });
    }

    const [did] = await LightdataORM.insert({
        db,
        table: "depositos",
        quien: userId,
        data: {
            direccion: direccionTrim,
            descripcion: isNonEmpty(descripcion) ? String(descripcion).trim() : null,
            codigo: isNonEmpty(codigo) ? String(codigo).trim() : null,
            email: isNonEmpty(email) ? String(email).trim() : null,
            telefono: isNonEmpty(telefono) ? String(telefono).trim() : null,
        },
    });

    return {
        success: true,
        message: "Depósito creado correctamente",
        data: { did, direccion: direccionTrim, codigo: toStr(codigo) },
        meta: { timestamp: new Date().toISOString() },
    };
}
