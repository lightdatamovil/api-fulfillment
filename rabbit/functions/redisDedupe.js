// redisDedupe.js
import { redisClient } from "../db.js";

export async function tryLockOrder(sellerId, orderNumber, ttlSec = 30) {
    const key = `ff_lock_${sellerId}_${orderNumber}`;

    // SET key value NX EX ttl  => solo crea si no existe
    const result = await redisClient.set(key, "1", {
        NX: true,
        EX: ttlSec,
    });

    return result === "OK";
}
