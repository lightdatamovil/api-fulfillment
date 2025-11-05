import { CustomException, Status, isNonEmpty, LightdataORM } from "lightdata-tools";

export async function editDeposito({ db, req }) {
    const { userId } = req.user || {};

    const depositoDid = Number(req.params?.depositoDid);

    if (!Number.isFinite(depositoDid) || depositoDid <= 0) {
        throw new CustomException({
            title: "Parámetros inválidos",
            message: "depositoDid debe ser un número válido en la URL",
            status: Status.badRequest,
        });
    }

    const { direccion, descripcion, codigo, email, telefono } = req.body || {};

    const [curr] = await LightdataORM.select({
        db,
        table: "depositos",
        where: { did: depositoDid },
        throwIfNotExists: true,
        throwIfNotExistsMessage: "No existe un depósito activo con ese DID.",
    });

    if (isNonEmpty(codigo)) {
        await LightdataORM.select({
            db,
            table: "depositos",
            where: { codigo: String(codigo).trim() },
            select: "did",
            throwIfExists: true,
            throwIfExistsMessage: "Ya existe otro depósito con ese código.",
        });
    }

    await LightdataORM.update({
        db,
        table: "depositos",
        where: { did: depositoDid },
        quien: userId,
        data: {
            direccion: isNonEmpty(direccion) ? String(direccion).trim() : curr.direccion,
            descripcion: isNonEmpty(descripcion) ? String(descripcion).trim() : curr.descripcion,
            codigo: isNonEmpty(codigo) ? String(codigo).trim() : curr.codigo,
            email: isNonEmpty(email) ? String(email).trim() : curr.email,
            telefono: isNonEmpty(telefono) ? String(telefono).trim() : curr.telefono,
        },
    });

    return {
        success: true,
        message: "Depósito versionado correctamente",
        data: { did: depositoDid },
        meta: { timestamp: new Date().toISOString() },
    };
}
