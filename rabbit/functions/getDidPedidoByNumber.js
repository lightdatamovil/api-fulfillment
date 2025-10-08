import { executeQuery } from "lightdata-tools";

export async function getPedidoDidByNumber(db, number) {
    const rows = await executeQuery(
        db,
        `SELECT did FROM pedidos WHERE number = ? AND elim = 0 ORDER BY autofecha DESC LIMIT 1`,
        [number]
    );
    const did = rows.did || 0;


    return did;
}