import { CustomException, executeQuery, Status } from "lightdata-tools";

export async function deleteCliente(dbConnection, req) {
    const { clienteId } = req.params;
    const nowUser = Number(req.user?.id ?? 0);

    // 1) Traer versión vigente
    const vigenteRows = await executeQuery(
        dbConnection,
        `SELECT did, nombre_fantasia, razon_social, codigo, observaciones, habilitado
       FROM clientes
      WHERE did = ? AND superado = 0 AND elim = 0
      LIMIT 1`,
        [clienteId]
    );

    const vigente = vigenteRows?.[0] || null;
    if (!vigente) {
        throw new CustomException({
            title: "No se pudo eliminar el cliente.",
            message:
                "No se pudo eliminar el cliente. Puede que no exista o ya esté eliminado.",
            status: Status.notFound,
        });
    }

    // 2) Superar vigente
    const upd = await executeQuery(
        dbConnection,
        `UPDATE clientes
        SET superado = 1, quien = ?
      WHERE did = ? AND superado = 0 AND elim = 0`,
        [nowUser || null, clienteId]
    );

    // Por si hubo carrera y no se superó
    if (upd.affectedRows === 0) {
        throw new CustomException({
            title: "No se pudo eliminar el cliente.",
            message:
                "No se pudo eliminar el cliente. Puede que ya esté eliminado o superado.",
            status: Status.notFound,
        });
    }

    // 3) Insertar nueva versión con MISMO did y elim = 1
    await executeQuery(
        dbConnection,
        `INSERT INTO clientes
       (did, nombre_fantasia, razon_social, codigo, observaciones, habilitado, quien, superado, elim)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
        [
            Number(clienteId),
            vigente.nombre_fantasia ?? null,
            vigente.razon_social ?? null,
            vigente.codigo ?? null,
            vigente.observaciones ?? null,
            Number(vigente.habilitado ?? 0),
            nowUser || null,
        ],
        true
    );

    return {
        success: true,
        message: "Cliente eliminado correctamente",
        data: { did: Number(clienteId) },
        meta: { timestamp: new Date().toISOString() },
    };
}
