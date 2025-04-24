const express = require('express');
const seller = express.Router();
const { getConnectionLocal } = require('../dbconfig');
const Empresa = require('../controller/empresa/empresa');
const { guardarEmpresasMap } = require('../fuctions/empresaMap');
const { saveSellerRedis } = require('../controller/seller/seller');

seller.post ('/', async (req, res) => {
    const data = req.body;
    try {
        const save =  await saveSellerRedis(data.seller, data.data);
        return res.status(200).json({
            estado: true,
            message: "Seller guardado en Redis"
        });
    } catch (error) {
        console.error('Error durante la operación:', error);
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
