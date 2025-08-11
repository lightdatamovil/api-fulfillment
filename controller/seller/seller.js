const { redisClient } = require("../../dbconfig").default;

async function saveSellerRedis(seller, data) {
    const keySellers = "seller_ff";
    const keySellersData = "seller_ff_data";

    if (typeof seller !== 'string') {
        throw new Error('El seller debe ser una cadena de texto');
    }

    if (!redisClient.isOpen) {
        await redisClient.connect();
    }

    const { operador } = data;

    if (operador === 'add') {
        const jsonData = JSON.stringify(data.data);

        await redisClient.sAdd(keySellers, seller);

        await redisClient.hSet(keySellersData, seller, jsonData);

        return `Seller ${seller} guardado en Redis`;

    } else if (operador === 'remove') {
        await redisClient.sRem(keySellers, seller);

        await redisClient.hDel(keySellersData, seller);

        return `Seller ${seller} eliminado de Redis`;

    } else {
        throw new Error('El operador debe ser "add" o "remove"');
    }
}

module.exports = {
    saveSellerRedis
}
