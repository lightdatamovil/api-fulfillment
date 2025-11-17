import { executeQuery } from "lightdata-tools";

export async function getPedidoDidByNumber(db, number) {
    const rows = await executeQuery({
        db,
        query: `SELECT did FROM pedidos WHERE number = ? AND elim = 0 ORDER BY autofecha DESC LIMIT 1`,
        values: [number]
    });
    const did = rows.did || 0;

    return did;
}