import { executeQuery } from "lightdata-tools";

export async function obtenerClienteCuentaTN(db, store) {

    const [rows] = await executeQuery({
        db,
        query: `SELECT * FROM clientes_cuentas WHERE ml_id_vendedor =  ? AND elim = 0 LIMIT 1`,
        values: [store],
        log: true
    });

    return { didCliente: rows.did_cliente, didCuenta: rows.did };
}