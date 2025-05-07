const express = require("express");
const stock = express.Router();

const {
  redisClient,
  getConnection,
  getCompanyById,
  getConnectionLocal,
} = require("../dbconfig");

const { logRed } = require("../fuctions/logsCustom");

const StockConsolidado = require("../controller/stock/stock_consolidado");

const Stock = require("../controller/stock/stock");
const MovimientoStock = require("../controller/stock/movimiento_stock");

stock.post("/stockConsolidado", async (req, res) => {
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
      productos: response,
    });
  } catch (error) {
    console.error("Error en /stock:", error);
    return res.status(500).json({
      estado: false,
      mensaje: "Error al obtener los atributos del producto.",
      error: error.message,
    });
  } finally {
    connection.end();
  }
});
stock.post("/stock", async (req, res) => {
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
      productos: response,
    });
  } catch (error) {
    console.error("Error en /stock:", error);
    return res.status(500).json({
      estado: false,
      mensaje: "Error al obtener los atributos del producto.",
      error: error.message,
    });
  } finally {
    connection.end();
  }
});

stock.post("/movimientoStock", async (req, res) => {
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
      stock: response,
    });
  } catch (error) {
    console.error("❌ Error en /movimientoStock:", error);
    return res.status(500).json({
      estado: false,
      mensaje: "Error al insertar movimiento de stock.",
      error: error.message,
    });
  } finally {
    connection.end();
  }
});

stock.get("/", async (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

module.exports = stock;
