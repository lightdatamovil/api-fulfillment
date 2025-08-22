import { Router } from "express";
import StockConsolidado from "../controller/stock/stock_consolidado.js";
import Stock from "../controller/stock/stock.js";
import MovimientoStock from "../controller/stock/movimiento_stock.js";
import { errorHandler, getFFProductionDbConfig, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import mysql2 from "mysql2";

const stock = Router();

stock.post("/stockConsolidado", async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
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
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
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
    return res.status(500).json({
      estado: false,
      mensaje: "Error al obtener los atributos del producto.",
      error: error.message,
    });
  } finally {
    connection.end();
  }
});


stock.put("/:st", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, ['clienteId'], []);

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await editCliente(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});
stock.post("/movimientoStock", async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
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
    return res.status(500).json({
      estado: false,
      mensaje: "Error al insertar movimiento de stock.",
      error: error.message,
    });
  } finally {
    connection.end();
  }
});

export default stock;
