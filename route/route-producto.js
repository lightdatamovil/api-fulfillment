const express = require('express');
const producto = express.Router();



const { redisClient,getConnection, getCompanyById, getConnectionLocal } = require('../dbconfig');

const { logRed } = require('../fuctions/logsCustom');

const ProductoCombo = require('../controller/producto/productoCombo');
const ProductoDeposito = require('../controller/producto/productoDeposito');
const ProductoEcommerce = require('../controller/producto/productoEcommerce');
const ProductO1 = require('../controller/producto/producto');
const Variante = require('../controller/producto/variante');
const StockConsolidado = require('../controller/producto/stock_consolidado');



producto.post('/producto', async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
      
        if (data.operador === 'eliminar') {
            const producto = new ProductO1();
       const response=  await producto.delete(connection, data.did);
       console.log("Respuesta de delete:", response);
       return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response
    });
        }
        if (data.operador === 'forzarEliminar') {
        const producto = new ProductO1();
        const response=  await producto.forzarDelete(connection, data.did);
        console.log("Respuesta de delete:", response);
        return res.status(200).json({
            estado: response.estado !== undefined ? response.estado : false,
            message: response.message || response
        });
        }
        else{

        // Crear nuevo producto
        const producto = new ProductO1(
            data.did ?? 0,
            data.cliente,
            data.sku,
            data.titulo,
            data.descripcion,
            data.imagen,
            data.habilitado,
            data.esCombo,
            data.posicion ?? "",
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection
        );

        const productoResult = await producto.insert();

        const productId= productoResult.insertId;

        // Procesar combos
      if (data.combo && Array.isArray(data.combo) ) {    
    // Convertir `combo` en un único objeto JSON
    const comboArray = JSON.stringify(data.combo.map(item => ({
        VariantId: item.did,
        cantidad: parseInt(item.cantidad) // Convertir cantidad a número
    })));

    console.log("Combo antes de insertar:", comboArray); // Verifica el formato correcto

    const productoCombo = new ProductoCombo(
        data.did ?? 0,
        productId,
        0, // cantidad general (se maneja dentro de combo)
        data.combo,
        data.quien,
        0,
        0,
        connection,

    );

    await productoCombo.insert();
}

if (data.variantes && Array.isArray(data.variantes)) {



    for (const variante of data.variantes) {
        const varianteA = new Variante(
            variante.did ?? 0,
            productId,    
            variante.sku,
            variante.cantidad,
            variante.variante,
            variante.habilitado, // habilitado
            data.quien,
            0,
            0,
          
            connection
            
        );
        console.log(varianteA,"productoDeposito");
        
 const resultsVariante =    await varianteA.insert();
 const variantId = resultsVariante.insertId;




        const stockConsolidado = new StockConsolidado(
            data.did ?? 0, // did se genera automáticamente
            productId,
            variantId, // didVariante (puede ser 0 si no se relaciona con una variante específica)
            variante.cantidad, // Asignar la cantidad total
            data.quien,
            0,
            0,
            connection
        );
    
        await stockConsolidado.insert();
    }
    }




        // Procesar depósitos
        if (data.depositos && Array.isArray(data.depositos)) {



            for (const deposito of data.depositos) {
                const productoDeposito = new ProductoDeposito(
                    deposito.did ?? 0,    
            data.did ??  productoResult.insertId,
                    deposito.did,

                    deposito.habilitado, // habilitado
                    data.quien,
                    0,
                    0,
                    connection
                );
                console.log(productoDeposito,"productoDeposito");
                
                await productoDeposito.insert();
            }
        }
    
        // Procesar ecommerce
        if (data.ecommerce && Array.isArray(data.ecommerce)) {
            for (const ecommerceItem of data.ecommerce) {
                const productoEcommerce = new ProductoEcommerce(
                    data.did ?? 0,
                    productoResult.insertId,
                    ecommerceItem.tienda,
    
                    ecommerceItem.link,
                    ecommerceItem.habilitado,
                    ecommerceItem.sync,
                    ecommerceItem.sku,
                    data.quien,
                    0,
                    0,
                    connection
                );
                await productoEcommerce.insert();
            }
        }


        return res.status(200).json({
            estado: true
            
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

producto.post("/getProductsId", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const producto= new ProductO1();
    const response = await producto.traerProductoId(connection, data.did);
    return res.status(200).json({
        estado: true,
        productos: response
    });
})
producto.post("/updateProducts", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const producto= new ProductO1(
        data.did ?? 0,
        data.cliente,
        data.sku,
        data.titulo,
        data.descripcion,
        data.imagen,
        data.habilitado,
        data.esCombo,
        data.posicion ?? "",
        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection
    );
    const response = await producto.checkAndUpdateDidProducto(connection, data.did);
    return res.status(200).json({
        estado: true,
        productos: response
    });
})
producto.post("/updateCombos", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
 
        const combo = new ProductoCombo(
            data.did ?? 0,
            data.did,
            data.cantidad ?? 0,
            data.combo,
          
        );
        await combo.checkAndUpdateDidProductoCombo(connection);
    

    return res.status(200).json({
        estado: true,
   
    });
})
producto.post("/updateEcommerce", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    for (const ecommerceItem of data.ecommerce) {
        const productoEcommerce = new ProductoEcommerce(
            data.did ?? 0,
            data.did,
            ecommerceItem.tienda,

            ecommerceItem.link,
            ecommerceItem.habilitado,
            ecommerceItem.sync,
            ecommerceItem.sku,
            data.quien,
            0,
            0,
            connection
        );
        await productoEcommerce.checkAndUpdateDidProductoEcommerce(connection);
    }
    return res.status(200).json({
        estado: true,
    
    });
})

producto.post("/updateDepositos", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    for (const deposito of data.depositos) {
        const productoDeposito = new ProductoDeposito(
            deposito.did ?? 0,    
              data.did ??  productoResult.insertId,
              deposito.did,
              deposito.habilitado, // habilitado
        );
        console.log(productoDeposito,"productoDeposito");
        
        await productoDeposito.checkAndUpdateDidProductoDeposito(connection);
    }
    return res.status(200).json({
        estado: true,
     
    });
})
producto.post("/getProducts", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const producto= new ProductO1();
    const response = await producto.traerProductos(connection, data);
    return res.status(200).json({
        estado: true,
        productos: response
    });
})


producto.get("/", async (req, res) => {
    res.status(200).json({
        estado: true,
        mesanje: "Hola chris"
    });

});


module.exports = producto;

