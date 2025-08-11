const amqp = require('amqplib');

const RABBITMQ_URL = 'amqp://lightdata:QQyfVBKRbw6fBb@158.69.131.226:5672';


(async () => {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);

        // Cierra la conexión luego de unos segundos para verificar conexión solamente
        setTimeout(async () => {
            await connection.close();
            process.exit(0);
        }, 3000);
    } catch (error) {
        process.exit(1);
    }
})();
