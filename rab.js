const amqp = require('amqplib');

const RABBITMQ_URL = 'amqp://lightdata:QQyfVBKRbw6fBb@158.69.131.226:5672';

function logConsola(mensaje, tipo = 'info') {
    const timestamp = new Date().toISOString();
    const colores = {
        info: '\x1b[36m%s\x1b[0m',    // Cyan
        ok: '\x1b[32m%s\x1b[0m',      // Green
        warn: '\x1b[33m%s\x1b[0m',    // Yellow
        error: '\x1b[31m%s\x1b[0m'    // Red
    };
    console.log(colores[tipo] || '%s', `[${timestamp}] ${mensaje}`);
}

(async () => {
    try {
        logConsola('Intentando conectar a RabbitMQ...', 'info');
        const connection = await amqp.connect(RABBITMQ_URL);
        logConsola('✅ Conexión exitosa a RabbitMQ', 'ok');

        // Cierra la conexión luego de unos segundos para verificar conexión solamente
        setTimeout(async () => {
            await connection.close();
            logConsola('🔌 Conexión cerrada correctamente', 'info');
            process.exit(0);
        }, 3000);
    } catch (error) {
        logConsola(`❌ Error conectando a RabbitMQ: ${error.message}`, 'error');
        process.exit(1);
    }
})();
