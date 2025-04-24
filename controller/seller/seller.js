const { redisClient } = require("../../dbconfig");

async function saveSellerRedis(seller, data) {
    const keySellers = "seller_ff";
    const keySellersData = "seller_ff_data";

    try {
        // Aseguramos que seller es un string
        if (typeof seller !== 'string') {
            throw new Error('El seller debe ser una cadena de texto');
        }

        // Conectar a Redis si no está conectado
        if (!redisClient.isOpen) {
            await redisClient.connect();
            console.log('Redis conectado');
        }

        // Comprobamos el valor de "operador" en data
        const { operador } = data;

        if (operador === 'add') {
            // Convertimos data a JSON (si no lo está)
            const jsonData = JSON.stringify(data.data);
           
            

            // Guardar seller en el set (para evitar duplicados)
            await redisClient.sAdd(keySellers, seller);

            // Guardar la data del seller en un hash
            await redisClient.hSet(keySellersData, seller, jsonData);

            console.log(`Seller ${seller} agregado a Redis`);

        } else if (operador === 'remove') {
            // Eliminar el seller del set
            await redisClient.sRem(keySellers, seller);

            // Eliminar la data del seller en el hash
            await redisClient.hDel(keySellersData, seller);

            console.log(`Seller ${seller} eliminado de Redis`);

        } else {
            throw new Error('El operador debe ser "add" o "remove"');
        }

    } catch (error) {
        console.error("Error guardando en Redis:", error);
        throw error;  // Lanza el error para que lo maneje la función que llame a saveSellerRedis
    }
}

module.exports = {
    saveSellerRedis
}
