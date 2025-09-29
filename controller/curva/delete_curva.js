import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Soft-delete de curva por DID.
 * Marca elim=1 en:
 *  - variantes_curvas (did = ?)
 *  - variantes_categorias_curvas (did_curva = ?)
 *
 * Entrada: body { did }
 */
export async function deleteCurva(dbConnection, req) {
    const didParam = req.body?.did ?? req.params?.did;
    const didCurva = Number(didParam);

    if (!Number.isFinite(didCurva) || didCurva <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "Se requiere 'did' numérico válido",
            status: Status.badRequest,
        });
    }

    const cur = await executeQuery(
        dbConnection,
        `SELECT did, elim FROM variantes_curvas WHERE did = ? LIMIT 1`,
        [didCurva]
    );

    if (!cur || cur.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No existe la curva con did ${didCurva}`,
            status: Status.notFound,
        });
    }

    if (Number(cur[0].elim) === 1) {
        return {
            success: true,
            message: "La curva ya estaba eliminada",
            data: { did: didCurva, affected: { curva: 0, links: 0 } },
            meta: { timestamp: new Date().toISOString() },
        };
    }

    const updLinks = await executeQuery(
        dbConnection,
        `UPDATE variantes_categorias_curvas SET elim = 1 WHERE did_curva = ?`,
        [didCurva],
        true
    );

    const updCurva = await executeQuery(
        dbConnection,
        `UPDATE variantes_curvas SET elim = 1 WHERE did = ?`,
        [didCurva],
        true
    );

    return {
        success: true,
        message: "Curva eliminada correctamente",
        data: {
            did: didCurva,
            affected: {
                curva: updCurva?.affectedRows ?? 0,
                links: updLinks?.affectedRows ?? 0,
            },
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
