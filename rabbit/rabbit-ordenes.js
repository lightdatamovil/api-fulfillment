
import amqp from "amqplib";
import { ESTADOS_CACHE, redisClient, urlRabbit } from "./db";
import { processOrderMessage } from "./functions/processOrderMessage";
import { logRed } from "lightdata-tools";

setInterval(() => {
  for (const k of Object.keys(ESTADOS_CACHE)) delete ESTADOS_CACHE[k];
}, 1000 * 60 * 60 * 24 * 14);


(async function main() {
  try {
    await redisClient.connect();
    let channelName = "ordenesFF";
    let connection = null;
    let channel = null;
    let isConnecting = false;

    const connect = async () => {
      if (isConnecting) return;
      isConnecting = true;

      try {
        if (channel) {
          await channel.close();
        }
        if (connection) {
          await connection.close();
        }

        connection = await amqp.connect(urlRabbit);
        channel = await connection.createChannel();
        await channel.assertQueue(channelName, { durable: true });

        channel.consume(
          channelName,
          async (msg) => {
            if (!msg) return;
            try {
              await processOrderMessage(msg.content.toString());
              channel.ack(msg);
            } catch (e) {
              logRed(e);
              channel.nack(msg, false, false);
            }
          },
          { noAck: false }
        );

        connection.on("close", () => {

          isConnecting = false;
          setTimeout(connect, 1000);
        });

        isConnecting = false;
      } catch (error) {
        logRed(error);
        isConnecting = false;
        setTimeout(connect, 1000);
      }
    };

    await connect();
  } catch (e) {
    logRed(e);
  } finally {
    await redisClient.disconnect();
  }
})();
