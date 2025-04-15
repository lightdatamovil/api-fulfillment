const express = require('express');
const fmas = express.Router();



const { redisClient,getConnection, getCompanyById, getConnectionLocal } = require('../dbconfig');
const Usuario = require('../controller/cliente/usuario');
const Cliente = require('../controller/cliente/cliente');
const Cliente_cuenta = require('../controller/cliente/cliente-cuenta');
const Deposito = require('../controller/fulfillmentmas/deposito');
const Ecommerce = require('../controller/fulfillmentmas/ecommerce');



fmas.post('/depositos', async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
      
        if (data.operador === 'eliminar') {
            const depositos = new Deposito();
       const response=  await depositos.delete(connection, data.did);
       console.log("Respuesta de delete:", response);
       return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response
    });
    
        }
        else{

        // Crear nuevo producto
        const deposito = new Deposito(
            data.did ?? 0,
            data.direccion ?? "",
            data.codigo ?? "",
            data.email ?? "",
            data.telefono ?? "",
        
            data.superado ?? 0,
            data.elim ?? 0,
            connection
        );

        const depositoResult = await deposito.insert();

        const depositoId = depositoResult.insertId;


    

        return res.status(200).json({
            estado: true,
            message: "Deposito creado correctamente",
            didUsuario: depositoId
            
        });
    }
    } catch (error) {
        console.error('Error durante la operación:', error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error
        });
    } finally {
        connection.end();
    }
});



fmas.post('/ecommerces', async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
      
        if (data.operador === 'eliminar') {
            const ecommerce = new Ecommerce();
       const response=  await ecommerce.delete(connection, data.did);
       console.log("Respuesta de delete:", response);
       return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response
    });
    
        }
        else{

        // Crear nuevo producto
        const ecommerce = new Ecommerce(
            data.did ?? 0,
            data.nombre,

            data.superado ?? 0,
            data.elim ?? 0,
            connection
        );

        const ecommerceResult = await ecommerce.insert();

        const ecommerceId = ecommerceResult.insertId;


    

        return res.status(200).json({
            estado: true,
            message: "Ecommerce creado correctamente",
            didUsuario: ecommerceId
            
        });
    }
    } catch (error) {
        console.error('Error durante la operación:', error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error
        });
    } finally {
        connection.end();
    }
});



fmas.get("/", async (req, res) => {
    res.status(200).json({
        estado: true,
        mesanje: "Hola chris"
    });

});


module.exports = fmas;

