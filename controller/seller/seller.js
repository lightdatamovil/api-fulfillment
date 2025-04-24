const { redisClient } = require("../../dbconfig");




async function saveSellerRedis(seller, data) {
    const keySellers = "seller_ff";
    const keySellersData = "seller_ff_data";

    try {
        // Aseguramos que seller es un string
        if (typeof seller !== 'string') {
            throw new Error('El seller debe ser una cadena de texto');
        }

        // Convertimos data a JSON (si no lo está)
        const jsonData = JSON.stringify(data);

        // Conectar a Redis si no está conectado
        if (!redisClient.isOpen) {
            await redisClient.connect();
            console.log('Redis conectado');
        }

        // Guardar seller en el set (para evitar duplicados)
        await redisClient.sAdd(keySellers, seller);

        // Guardar la data del seller en un hash
        await redisClient.hSet(keySellersData, seller, jsonData);

    } catch (error) {
        console.error("Error guardando en Redis:", error);
        throw error;  // Lanza el error para que lo maneje la función que llame a saveSellerRedis
    }
}



module.exports = {
    saveSellerRedis
}