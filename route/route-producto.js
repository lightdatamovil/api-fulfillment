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
const Atributo = require('../controller/producto/atributos');
const Atributo_valor = require('../controller/producto/atributo_valor');
const Stock = require('../controller/producto/stock');
const MovimientoStock = require('../controller/producto/movimiento_stock');



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
          variante.data,
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

        if (data.ecommerce && Array.isArray(data.ecommerce)) {
            for (const ecommerceItem of data.ecommerce) {
                const productoEcommerce = new ProductoEcommerce(
                    data.did ?? 0,
                    productoResult.insertId,
                    variantId ?? 0,
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
            data.didVariante ?? 0,
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

producto.post("/atributos", async (req, res) => {
    try {
        const data = req.body;
        const connection = await getConnectionLocal(data.idEmpresa);

        const atributo = new Atributo(    data.did ?? 0,
            data.nombre,
            data.descripcion,
            data.orden, 
            data.habilitado ,
            data.codigo,
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
         connection)    ;
         console.log("atributo",atributo);
         
        const response = await atributo.insert( ); 

        for (const valor of data.valores) {

            

        const atributoValor = new Atributo_valor(
            valor.did ?? 0,
            data.did == 0 ? response.insertId : data.did,
            valor.valor,
            data.orden,
            data.habilitado ?? 1,
            valor.codigo,
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection
        );
        await atributoValor.insert();}

        return res.status(200).json({
            estado: true,
            atributo: response
        });
    } catch (error) {
        console.error("Error en /atributos:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message
        });
    }
});

producto.post("/getAtributoValor", async (req, res) => {
    try {
        const data = req.body;
        const connection = await getConnectionLocal(data.idEmpresa);
        const atributo = new Atributo();
        const response = await atributo.getAll(connection,data.did);
        
        return res.status(200).json({
            estado: true,
            atributos: response
        });
    } catch (error) {
        console.error("Error en /getAtributos:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Ocurrió un error al obtener los atributos",
            error: error.message
        });
    }
});
producto.post("/getAtributosFiltro", async (req, res) => {
    try {
        const data = req.body;
        const connection = await getConnectionLocal(data.idEmpresa);
        const atributo = new Atributo();
        const response = await atributo.getAtributos(connection,data);
        
        return res.status(200).json({
            estado: true,
            atributos: response
        });
    } catch (error) {
        console.error("Error en /getAtributos:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Ocurrió un error al obtener los atributos",
            error: error.message
        });
    }
});

producto.post("/stockConsolidado", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
try {
    const stock = new StockConsolidado(
        data.did ?? 0,
        data.didProducto ?? 0,
        data.didVariante ?? 0,
        data.stock,
        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection

    );
    const response = await stock.insert();
 
    return res.status(200).json({
        estado: true,
        productos: response
    });
} catch (error) {
    console.error("Error en /stock:", error);
    return res.status(500).json({
        estado: false,
        mensaje: "Error al obtener los atributos del producto.",
        error: error.message
    });
} finally{
    connection.end();
}
});
producto.post("/stock", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    try {
        const stock = new Stock(
            data.did ?? 0,
            data.didProducto ?? 0,
            data.didVariante ?? 0,
            data.cantidad,
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection

        );
        const response = await stock.insert();
     
        return res.status(200).json({
            estado: true,
            productos: response
        });
    } catch (error) {
        console.error("Error en /stock:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message
        });
    } finally{
        connection.end();
    }
    
})




producto.post("/movimientoStock", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    try {
     

        const stock = new MovimientoStock(
            data.did ?? 0,
            data.data,
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection
        );

        const response = await stock.insert();

      
        return res.status(200).json({
            estado: true,
            stock: response
        });
    } catch (error) {
        console.error("❌ Error en /movimientoStock:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Error al insertar movimiento de stock.",
            error: error.message
        });
    } finally {
        connection.end(); 
      
    }
});

            

producto.get("/", async (req, res) => {
    res.status(200).json({
        estado: true,
        mesanje: "Hola chris"
    });

});


module.exports = producto;

