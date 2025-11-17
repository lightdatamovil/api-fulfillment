import { executeQuery } from "lightdata-tools";

export async function obtenerClienteCuenta(db, ml_id_vendedor) {

    const rows = await executeQuery({
        db,
        query: `SELECT * FROM clientes_cuentas WHERE ml_id_vendedor = ? AND elim = 0 LIMIT 1`,
        values: [ml_id_vendedor]
    });

    return { didCliente: rows[0].did_cliente, didCuenta: rows[0].did_cuenta };
}