import { redisClient } from "../db.js";

export async function getSellerData(seller_id) {
    if (!redisClient.isOpen) await redisClient.connect();
    const raw = await redisClient.hGet("seller_ff_data", String(seller_id));
    return raw ? JSON.parse(raw) : null;
}