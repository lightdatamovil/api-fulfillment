import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import mysql2 from "mysql2";
import { deleteCliente } from "../controller/cliente/delete_cliente.js";
import { getClienteById } from "../controller/cliente/get_cliente_by_id.js";
import { getFilteredClientes } from "../controller/cliente/get_filtered_clientes.js";
import { createCliente } from "../controller/cliente/create_cliente.js";
import { editCliente } from "../controller/cliente/edit_cliente.js";

const clientes = Router();

clientes.post("/", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    /*
    verifyHeaders(req, []);
    verifyAll(req, [], {
      required: ['nombre_fantasia', 'razon_social', 'codigo'],
      optional: []
    });
*/
    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await createCliente(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

clientes.put("/:clienteId", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {/*
    verifyHeaders(req, []);
    verifyAll(req, ['clienteId'], {
      required: ['nombre_fantasia', 'habilitado', 'observaciones', 'direccionesData', 'contactosData', 'cuentasData'],
      optional: []
    });
*/
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

clientes.get("/:clienteId", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, ['clienteId'], {});

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getClienteById(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

clientes.get("/", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, [], {});

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getFilteredClientes(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

clientes.delete("/:clienteId", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, ['clienteId'], {});

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await deleteCliente(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

export default clientes;
