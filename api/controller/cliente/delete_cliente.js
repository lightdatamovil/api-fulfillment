import { CustomException, Status, LightdataQuerys } from "lightdata-tools";

export async function deleteCliente(dbConnection, req) {
    const { clienteId } = req.params;
    const { userId } = req.user ?? {};

    // 1) Traer vigente por did
    const [vigente] = await LightdataQuerys.select({
        dbConnection,
        table: "clientes",
        column: "did",
        value: clienteId,
        throwExceptionIfNotExists: true,
    });

    if (Number(vigente.superado ?? 0) !== 0 || Number(vigente.elim ?? 0) !== 0) {
        throw new CustomException({
            title: "No se pudo eliminar el cliente.",
            message:
                "No se pudo eliminar el cliente. Puede que no exista o ya esté eliminado.",
            status: Status.notFound,
        });
    }

    // 2) Superar vigente
    await LightdataQuerys.update({
        dbConnection,
        table: "clientes",
        did: Number(clienteId),
        quien: userId,
        data: { superado: 1 },
    });

    // 3) Insertar nueva versión con mismo did y elim = 1
    await LightdataQuerys.insert({
        dbConnection,
        table: "clientes",
        quien: userId,
        data: {
            did: Number(clienteId),
            nombre_fantasia: vigente.nombre_fantasia ?? null,
            razon_social: vigente.razon_social ?? null,
            codigo: vigente.codigo ?? null,
            observaciones: vigente.observaciones ?? null,
            habilitado: Number(vigente.habilitado ?? 0),
            superado: 0,
            elim: 1,
        },
    });

    return {
        success: true,
        message: "Cliente eliminado correctamente",
        data: { did: Number(clienteId) },
        meta: { timestamp: new Date().toISOString() },
    };
}
