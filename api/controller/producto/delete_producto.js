import { LightdataORM } from "lightdata-tools";
/**
 * Elimina un producto y sus asociaciones usando LightdataORM.
 *  - Marca las asociaciones como eliminadas (elim=1).
 *  - Marca el producto principal como eliminado (elim=1).
 */
export async function deleteProducto(dbConnection, req) {
    const { did } = req.params;
    const quien = req.user.userId;

    await LightdataORM.select({
        dbConnection,
        table: "productos",
        where: { did: did },
        throwIfNotExists: true,
    });

    await LightdataORM.delete({
        dbConnection,
        table: "productos",
        where: { did: did },
        quien,
        throwIfNotFound: true,
    });

    const dependencias = [
        "productos_depositos",
        "productos_insumos",
        "productos_variantes_valores",
        "productos_ecommerce",
        "productos_combos",
    ];

    const affected = {};

    for (const table of dependencias) {
        try {
            await LightdataORM.delete({
                dbConnection,
                table,
                where: { did_producto: did },
                quien,
            });
            affected[table] = "OK";
        } catch (err) {
            affected[table] = `Error: ${err.message}`;
        }
    }

    return {
        success: true,
        message: "Producto eliminado correctamente (soft-delete versionado).",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
