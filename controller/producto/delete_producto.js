import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Soft-delete por DID:
 *  - producto.elim = 1 (todas las versiones o sólo las vigentes, según prefieras)
 *  - asociaciones elim = 1 (vigentes)
 */
export async function deleteProducto(dbConnection, req) {
    const didParam = req.body?.did ?? req.params?.did;
    const didProducto = Number(didParam);

    if (!Number.isFinite(didProducto) || didProducto <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "Se requiere 'did' numérico válido",
            status: Status.badRequest,
        });
    }

    const cur = await executeQuery(
        dbConnection,
        `SELECT did FROM productos WHERE did = ? AND elim = 0 LIMIT 1`,
        [didProducto]
    );
    if (!cur || cur.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No existe producto activo con did ${didProducto}`,
            status: Status.notFound,
        });
    }

    // Asociaciones -> elim=1 (sólo vigentes)
    const updDep = await executeQuery(
        dbConnection,
        `UPDATE productos_depositos SET elim = 1 WHERE did_producto = ? AND elim = 0`,
        [didProducto],
        true
    );
    const updIns = await executeQuery(
        dbConnection,
        `UPDATE productos_insumos SET elim = 1 WHERE did_producto = ? AND elim = 0`,
        [didProducto],
        true
    );
    const updVV = await executeQuery(
        dbConnection,
        `UPDATE productos_variantes_valores SET elim = 1 WHERE did_producto = ? AND elim = 0`,
        [didProducto],
        true
    );
    const updEc = await executeQuery(
        dbConnection,
        `UPDATE productos_ecommerce SET elim = 1 WHERE did_producto = ? AND elim = 0`,
        [didProducto],
        true
    );
    const updCombo = await executeQuery(
        dbConnection,
        `UPDATE productos_combos SET elim = 1 WHERE did_producto = ? AND elim = 0`,
        [didProducto],
        true
    );

    // Producto -> elim=1 (todas las filas del did)
    const updProd = await executeQuery(
        dbConnection,
        `UPDATE producto SET elim = 1 WHERE did = ? AND elim = 0`,
        [didProducto],
        true
    );

    return {
        success: true,
        message: "Producto eliminado correctamente",
        data: {
            did: didProducto,
            affected: {
                producto: updProd?.affectedRows ?? 0,
                depositos: updDep?.affectedRows ?? 0,
                insumos: updIns?.affectedRows ?? 0,
                variantesValores: updVV?.affectedRows ?? 0,
                ecommerce: updEc?.affectedRows ?? 0,
                combo: updCombo?.affectedRows ?? 0,
            },
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
