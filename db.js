import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config({ path: process.env.ENV_FILE || ".env" });

const redisClient = createClient({
  socket: {
    host: "192.99.190.137",
    port: 50301,
  },
  password: "sdJmdxXC8luknTrqmHceJS48NTyzExQg",
});

redisClient.on("error", (err) => {
});

(async () => {
  await redisClient.connect();
})();

export const hostFulFillement = process.env.FULFILLMENT_DB_HOST;
export const portFulFillement = process.env.FULFILLMENT_DB_PORT;
export default {
  redisClient,
};
