import { CustomException, executeQuery, Status } from "lightdata-tools";

export async function deleteProducto(dbConnection, req) {
    const { productoId } = req.params;

    const deleteQuery =
        "UPDATE productos SET elim = 1 WHERE did = ? AND superado = 0 AND elim = 0";
    const result = await executeQuery(dbConnection, deleteQuery, [productoId], true);
    if (result.affectedRows === 0) {
        throw new CustomException({
            title: "No se pudo eliminar el producto.",
            message: "No se pudo eliminar el producto. Puede que no exista o ya esté eliminado.",
            status: Status.notFound
        });
    }
    return {
        success: true,
        message: "Producto eliminado correctamente",
        data: {
            did: productoId
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}