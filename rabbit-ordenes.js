const amqp = require('amqplib');

const RABBITMQ_URL = 'amqp://lightdata:QQyfVBKRbw6fBb@158.69.131.226:5672'; // Cambia según tu configuración
async function listenToChannel(channelName) {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        
        await channel.assertQueue(channelName, { durable: true });

        console.log(`Escuchando mensajes en el canal: ${channelName}`);

        channel.consume(channelName, (msg) => {
            if (msg !== null) {
                console.log(`Mensaje recibido en ${channelName}:`, msg.content.toString());
                channel.ack(msg);  // Reconocer el mensaje manualmente
            }
        }, { noAck: false }); // Asegurarse de que no use autoAck

    } catch (error) {
        console.error(`Error al escuchar el canal ${channelName}:`, error);
    }
}
listenToChannel('ordenesFF');