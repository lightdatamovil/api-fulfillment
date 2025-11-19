import { executeQuery } from "lightdata-tools";

export async function obtenerClienteCuentaTN(db, store) {

    const rows = await executeQuery({
        db,
        query: `SELECT * FROM clientes_cuentas WHERE data like '%?%' ? AND elim = 0 LIMIT 1`,
        values: [store]
    });

    return { didCliente: rows[0].did_cliente, didCuenta: rows[0].did };
}