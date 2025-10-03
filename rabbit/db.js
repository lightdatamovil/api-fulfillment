import { logRed } from "lightdata-tools";
import { createClient as createRedisClient } from "redis";
import dotenv from "dotenv";

dotenv.config({ path: process.env.ENV_FILE || ".env" });

//sdad Configuración de la base de datos de fulfillment
export const hostFulFillement = "149.56.182.49";
export const portFulFillement = 44347;
export const urlRabbit = process.env.RABBITMQ_URL;
export const redisClient = createRedisClient({
    socket: { host: "192.99.190.137", port: 50301 },
    password: "sdJmdxXC8luknTrqmHceJS48NTyzExQg",
});
export const ORDENES_CACHE = Object.create(null);
export const ESTADOS_CACHE = Object.create(null);
redisClient.on("error", (err) =>
    logRed("[redis:error]", { err: err?.message || err })
);
