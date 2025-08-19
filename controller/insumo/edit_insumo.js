import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Edita un insumo existente.
 * - Marca superado=1 en la versión activa del did.
 * - Inserta una nueva fila con ese mismo did y los campos actualizados.
 * - Valida que el insumo exista (por did = :insumoId).
 * - Valida que el "codigo" no esté usado por otro insumo distinto.
 */
export async function editInsumo(dbConnection, req) {
    const { codigo, clientes, habilitado, nombre, unidad } = req.body;
    const { userId } = req.user;
    const { insumoId } = req.params;

    // 1) Verificar existencia
    const qGet = `
        SELECT did, codigo, nombre, habilitado, unidad, clientes
        FROM insumos
        WHERE did = ? AND elim = 0 AND superado = 0
        LIMIT 1
    `;
    const rows = await executeQuery(dbConnection, qGet, [insumoId]);
    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "Insumo no encontrado",
            message: `No existe insumo con did=${insumoId}`,
            status: Status.notFound,
        });
    }
    const current = rows[0];

    if (isNonEmpty(codigo)) {
        const qDup = `
            SELECT did
            FROM insumos
            WHERE codigo = ? AND elim = 0 AND superado = 0 AND did <> ?
            LIMIT 1
        `;
        const dup = await executeQuery(dbConnection, qDup, [codigo, insumoId]);
        if (dup && dup.length > 0) {
            throw new CustomException({
                title: "Código duplicado",
                message: `Ya existe un insumo con código "${codigo}"`,
                status: Status.conflict,
            });
        }
    }

    // 2) Preparar nuevos valores (si no vienen, usar los actuales)
    const newCodigo = isNonEmpty(codigo) ? String(codigo).trim() : current.codigo;
    const newNombre = isNonEmpty(nombre) ? String(nombre).trim() : current.nombre;
    const newUnidad = isNonEmpty(unidad) ? String(unidad).trim() : current.unidad;
    const newClientes = isDefined(clientes) ? clientes : current.clientes;

    let habValue = current.habilitado;
    if (isDefined(habilitado)) {
        const hab = number01(habilitado);
        if (hab !== 0 && hab !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: `habilitado debe ser 0 o 1`,
                status: Status.badRequest,
            });
        }
        habValue = hab;
    }

    // 3) Marcar superado=1 y crear nueva fila
    await executeQuery(
        dbConnection,
        `UPDATE insumos SET superado = 1 WHERE did = ? AND elim = 0 AND superado = 0`,
        [insumoId]
    );

    const insertQuery = `
        INSERT INTO insumos (did, codigo, clientes, habilitado, nombre, unidad, quien, superado)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `;
    const insertResult = await executeQuery(
        dbConnection,
        insertQuery,
        [insumoId, newCodigo, newClientes, habValue, newNombre, newUnidad, userId]
    );

    if (!insertResult || insertResult.affectedRows === 0) {
        throw new CustomException({
            title: "Error al versionar insumo",
            message: "No se pudo crear la nueva versión del insumo",
            status: Status.internalServerError,
        });
    }

    return {
        success: true,
        message: "Insumo actualizado correctamente",
        data: { did: insumoId },
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
}

// ---------------- Helpers ----------------
const isDefined = (v) => v !== undefined && v !== null;
const isNonEmpty = (v) =>
    isDefined(v) && (typeof v !== "string" || v.trim() !== "");

const number01 = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) return -1;
    return n === 1 ? 1 : n === 0 ? 0 : -1;
};
