const express = require("express");
const router = express.Router();

const {
  redisClient,
  getConnection,
  getCompanyById,
  getConnectionLocal,
} = require("../dbconfig");

const Insumo = require("../controller/fulfillment/insumos");
const MovimientosStockLineas = require("../controller/fulfillment/movimientos_stock_lineas");
const Movimientos_stock = require("../controller/fulfillment/movimientos_stock");

const ProductoCombo = require("../controller/producto/productoCombo");
const ProductoDeposito = require("../controller/producto/productoDeposito");
const ProductoEcommerce = require("../controller/producto/productoEcommerce");
const ProductO1 = require("../controller/producto/producto");

router.post("/insumos", async (req, res) => {
  const data = req.body;
  const connection = await getConnection(data.idEmpresa);

  try {
    if (data.operador == "eliminar") {
      const cuenta = new Insumo(); // Instanciar la clase
      await cuenta.eliminar(connection, data.did);
    } else {
      const cuenta = new Insumo(
        data.did ?? 0,
        data.didCliente,
        data.sku,
        data.descripcion,
        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection,
        data.idEmpresa
      );
      const resultado = await cuenta.insert();
    }

    return res.status(200).json({
      estado: true,
      didCuenta: data.did,
    });
  } catch (error) {
    console.error("Error durante la inserción:", error);

    return res.status(500).json({
      estado: false,
      error: -1,
      message: error,
    });
  } finally {
    connection.end();
  }
});

router.post("/movimientos-stock-lineas", async (req, res) => {
  const data = req.body;
  const connection = await getConnection(data.idEmpresa);

  try {
    if (data.operador === "eliminar") {
      const movimiento = new MovimientosStockLineas();
      await movimiento.eliminar(connection, data.did);
    } else {
      const movimiento = new MovimientosStockLineas(
        data.did ?? 0,
        data.didMovimiento,
        data.didProducto,
        data.didDeposito,
        data.tipo,
        data.cantidad,
        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection
      );
      await movimiento.insert();
    }

    return res.status(200).json({
      estado: true,
      didCuenta: data.did,
    });
  } catch (error) {
    console.error("Error durante la operación:", error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

router.post("/movimientos-stock", async (req, res) => {
  const data = req.body;
  const connection = await getConnection(data.idEmpresa);

  try {
    if (data.operador === "eliminar") {
      const movimiento = new ProductO1();
      await movimiento.eliminar(connection, data.did);
    } else {
      let fecha = new Date();
      fecha.setHours(fecha.getHours() - 3);
      const movimiento = new Movimientos_stock(
        data.did ?? 0,
        data.didCliente,
        fecha,
        data.didConcepto,
        data.didArmado,
        data.observaciones,
        data.lineas,
        data.total,
        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection
      );
      //  console.log(movimiento, "movimiento");

      await movimiento.insert();
    }

    return res.status(200).json({
      estado: true,
      didCuenta: data.did,
    });
  } catch (error) {
    console.error("Error durante la operación:", error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

router.post("/producto", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    if (data.operador === "eliminar") {
      const producto = new ProductO1();
      const response = await producto.delete(connection, data.did);
      console.log("Respuesta de delete:", response);
      return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response,
      });
    }
    if (data.operador === "forzarEliminar") {
      const producto = new ProductO1();
      const response = await producto.forzarDelete(connection, data.did);
      console.log("Respuesta de delete:", response);
      return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response,
      });
    } else {
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
        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection
      );

      const productoResult = await producto.insert();

      const productId = productoResult.insertId;

      // Procesar combos
      if (data.combo && Array.isArray(data.combo)) {
        // Convertir `combo` en un único objeto JSON
        const comboArray = JSON.stringify(
          data.combo.map((item) => ({
            did: item.did,
            cantidad: parseInt(item.cantidad, 10), // Convertir cantidad a número
          }))
        );

        console.log("Combo antes de insertar:", comboArray); // Verifica el formato correcto

        const productoCombo = new ProductoCombo(
          data.did ?? 0,
          productId,
          0, // cantidad general (se maneja dentro de combo)
          data.quien,
          0,
          0,
          comboArray, // Ahora es un solo JSON string, no un array
          connection
        );

        await productoCombo.insert();
      }

      // Procesar depósitos
      if (data.depositos && Array.isArray(data.depositos)) {
        for (const deposito of data.depositos) {
          const productoDeposito = new ProductoDeposito(
            data.depositos.did ?? 0,
            productoResult.insertId,
            deposito.did,

            deposito.habilitado, // habilitado
            data.quien,
            0,
            0,
            connection
          );
          //  console.log(productoDeposito, "productoDeposito");

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
            data.quien,
            0,
            0,
            connection
          );
          await productoEcommerce.insert();
        }
      }

      return res.status(200).json({
        estado: true,
        didCuenta: productoResult.insertId,
      });
    }
  } catch (error) {
    console.error("Error durante la operación:", error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});
router.post("/getProducts", async (req, res) => {
  const Producto = new ProductO1();
  const data = req.body;
  const connection = await getConnection(data.idEmpresa);
  const response = await Producto.traerProducto(connection);
  return res.status(200).json({
    estado: true,
    productos: response,
  });
});

router.get("/", async (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

module.exports = router;
