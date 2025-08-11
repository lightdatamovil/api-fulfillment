import { createClient } from "redis";
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


export default {
  redisClient,
};
