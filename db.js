import { createClient } from "redis";
import dotenv from "dotenv";
import { CompaniesService, logRed } from "lightdata-tools";

dotenv.config({ path: process.env.ENV_FILE || ".env" });

/// Redis para obtener las empresas
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisPassword = process.env.REDIS_PASSWORD;

// Configuración de la base de datos de fulfillment
export const hostFulFillement = process.env.FULFILLMENT_DB_HOST;
export const portFulFillement = process.env.FULFILLMENT_DB_PORT;

export const jwtSecret = process.env.JWT_SECRET;

export const redisClient = createClient({
  socket: {
    host: redisHost,
    port: redisPort,
  },
  password: redisPassword,
});

redisClient.on("error", (err) => {
  logRed(err);
});
export const companiesService = new CompaniesService({ redisClient, redisKey: "empresasFF" })
export default redisClient;