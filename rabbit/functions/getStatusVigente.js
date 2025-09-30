import { executeQuery } from "lightdata-tools";
import { ESTADOS_CACHE } from "../db.js";

export async function getStatusVigente(db, did) {
    if (ESTADOS_CACHE[did]) {
        return ESTADOS_CACHE[did];
    }
    const rows = await executeQuery(
        db,
        `SELECT status FROM pedidos WHERE did = ? AND superado = 0 AND elim = 0 LIMIT 1`,
        [did]
    );
    const s = rows?.length ? rows[0].status : null;
    if (s != null) ESTADOS_CACHE[did] = s;
    return s;
}
