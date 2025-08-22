import { Router } from "express"
import { errorHandler, getFFProductionDbConfig, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools"
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js"
import mysql2 from "mysql2"

const pedido = Router()

pedido.post("/subida-masiva", verifyToken, async (req, res) => {
  const data = req.body
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const estadoRepetido = await Ordenes.esEstadoRepetido(connection, data.numero_venta, "pendiente")

  if (estadoRepetido) {
    return res.status(200).json({
      estado: false,
      mensaje: "Estado repetido, no se realizaron cambios",
    })
  }

  try {
    const ordenes = new Ordenes(
      0,
      0,
      data.codigoCliente ?? 0,
      0,
      "pendiente", // status fijo
      0, // flex
      data.numero_venta ?? "",
      data.observaciones ?? "",
      0, // armado
      0, // descargado
      null, // fecha armado
      data.fecha_venta ?? null,
      0, // quien_armado
      data.id_envio ?? null,
      "",
      "", // ml_id, ml_pack_id
      "", // buyer_id
      "", // buyer_nickname
      data.nombre ?? "",
      data.apellido ?? "",
      data.total ?? "",
      "", // seller_sku
      connection
    )

    const response = await ordenes.insert()
    const didOrden = response.insertId

    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        const ordenes_items = new Ordenes_items(
          0,
          didOrden,
          0,
          "",
          "", // descripción
          "", // ml_id
          "", // dimensiones
          item.cantidad ?? 0,
          "", // variation_attributes
          item.seller_sku ?? "",
          0, // use_product_id
          0, // id_variation
          0,
          0,
          0,

          connection
        )

        await ordenes_items.insert()
      }
    }

    return res.status(200).json({
      estado: true,
      data: response,
    })
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    })
  } finally {
    connection.end()
  }
});

pedido.post("/masivo", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, [], []);

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getPedidoById(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

pedido.get("/", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, [], []);

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getPedidoById(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

pedido.get("/:pedidoId", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, ['pedidoId'], []);

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getPedidoById(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

pedido.put("/:pedidoId", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, ['pedidoId'], []);

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getPedidoById(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

pedido.delete("/:pedidoId", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, ['pedidoId'], []);

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getPedidoById(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

export default pedido
