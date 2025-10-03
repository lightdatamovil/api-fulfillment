import { CustomException, executeQuery, Status } from "lightdata-tools";

export async function deleteInsumo(dbConnection, req) {
    const { insumoId } = req.params;

    // 1) Buscar la versión activa del insumo por did
    const qGet = `
    SELECT id, elim, superado
    FROM insumos
    WHERE did = ? AND superado = 0
    LIMIT 1
  `;
    const rows = await executeQuery(dbConnection, qGet, [insumoId]);

    if (!rows?.length) {
        // no hay versión activa: o nunca existió o ya fue versionado/eliminado
        throw new CustomException({
            title: "Insumo no encontrado",
            message: `No existe insumo activo con did=${insumoId}`,
            status: Status.notFound,
        });
    }

    const current = rows[0];

    if (Number(current.elim) === 1) {
        throw new CustomException({
            title: "Insumo ya eliminado",
            message: `El insumo con did=${insumoId} ya está eliminado.`,
            status: Status.conflict,
        });
    }

    // 2) Marcar elim=1 en la versión activa del insumo
    const qDelInsumo = `
    UPDATE insumos
    SET elim = 1
    WHERE did = ? AND superado = 0 AND elim = 0
    LIMIT 1
  `;
    const upd = await executeQuery(dbConnection, qDelInsumo, [insumoId]);

    if (!upd?.affectedRows) {
        throw new CustomException({
            title: "No se pudo eliminar",
            message:
                "No se pudo eliminar el insumo. Puede que ya esté eliminado o no exista una versión activa.",
            status: Status.notFound,
        });
    }

    // 3) Marcar elim=1 en vínculos activos de insumos_clientes (opcional pero recomendado)
    const qDelLinks = `
    UPDATE insumos_clientes
    SET elim = 1
    WHERE did_insumo = ? AND superado = 0 AND elim = 0
  `;
    await executeQuery(dbConnection, qDelLinks, [insumoId]);

    return {
        success: true,
        message: "Insumo eliminado correctamente",
        data: { did: Number(insumoId) },
        meta: { timestamp: new Date().toISOString() },
    };
}
