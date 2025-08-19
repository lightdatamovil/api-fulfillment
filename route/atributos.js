import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, logPurple, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import mysql2 from "mysql2";
import { getFilteredAtributos } from "../controller/atributo/get_filtered_atributos.js";
import { getAtributoById } from "../controller/atributo/get_atributo_by_id.js";
import { deleteAtributo } from "../controller/atributo/delete_atributo.js";
import { createAtributo } from "../controller/atributo/create_atributo.js";

const atributo = Router();


atributo.post("/", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, [], ['codigo', 'nombre', 'descripcion', 'habilitado', 'orden', 'atributoValores']);

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await createAtributo(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

atributo.delete("/:atributoId", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, ['atributoId'], []);

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await deleteAtributo(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

atributo.get("/:atributoId", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getAtributoById(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

atributo.get("/", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getFilteredAtributos(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

atributo.post("/:atributoId/valores", verifyToken(jwtSecret), async (req, res) => {
  const startTime = performance.now();

  let dbConnection;

  try {
    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getFilteredAtributos(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
    if (dbConnection) dbConnection.end();
  }
});

atributo.delete("/:atributoId/valores/:valorId", verifyToken(jwtSecret), async (req, res) => {
  const startTime = performance.now();

  let dbConnection;

  try {
    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getFilteredAtributos(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
    if (dbConnection) dbConnection.end();
  }
});

atributo.put("/:atributoId/valores/:valorId", verifyToken(jwtSecret), async (req, res) => {
  const startTime = performance.now();

  let dbConnection;

  try {
    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getFilteredAtributos(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
    if (dbConnection) dbConnection.end();
  }
});

export default atributo;