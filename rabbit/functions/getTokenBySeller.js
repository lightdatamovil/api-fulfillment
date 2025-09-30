import { redisClient } from "../db.js";

export async function getTokenBySeller(seller_id) {
    if (!redisClient.isOpen) await redisClient.connect();
    const token = await redisClient.hGet("token", String(seller_id));
    return token || null;
}