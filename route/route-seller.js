const express = require('express');
const seller = express.Router();
const { saveSellerRedis } = require('../controller/seller/seller');

seller.post('/', async (req, res) => {
    const data = req.body;
    try {
        const save = await saveSellerRedis(data.seller, data);
        return res.status(200).json({
            estado: true,
            message: save
        });
    } catch (error) {
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error
        });
    }
});

seller.get("/", async (req, res) => {
    res.status(200).json({
        estado: true,
        mesanje: "Hola chris"
    });
});

module.exports = seller;
