import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, logPurple, Status, verifyToken } from "lightdata-tools";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import mysql2 from "mysql2";
import { getFilteredAtributos } from "../controller/atributo/get_filtered_atributos.js";
import { getAtributoById } from "../controller/atributo/get_atributo_by_id.js";
import { deleteAtributo } from "../controller/atributo/delete_atributo.js";

const atributo = Router();

atributo.post("/", verifyToken(jwtSecret), async (req, res) => {
  try {
    const data = req.body;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

    const atributo = new Atributo(
      data.did ?? 0,
      data.nombre,
      data.descripcion,
      data.orden,
      data.habilitado,
      data.codigo,
      data.quien,
      data.superado ?? 0,
      data.elim ?? 0,
      connection
    );

    const response = await atributo.insert();

    const didAtributo = data.did == 0 ? response.insertId : data.did;

    const helperValor = new Atributo_valor();
    const didsActuales = Array.isArray(data.valores)
      ? data.valores.map((v) => v.did).filter((d) => d > 0)
      : [];
    await helperValor.deleteMissing(connection, didAtributo, didsActuales);

    if (Array.isArray(data.valores)) {
      for (const valor of data.valores) {
        const atributoValor = new Atributo_valor(
          valor.did ?? 0,
          didAtributo,
          valor.valor,
          data.orden,
          data.habilitado ?? 1,
          valor.codigo,
          data.quien,
          data.superado ?? 0,
          data.elim ?? 0,
          connection
        );
        await atributoValor.insert();
      }
    }

    if (response.estado === false) {
      return res.status(200).json({
        estado: false,
        message: response.message || response,
      });
    }

    return res.status(200).json({
      estado: true,
      atributo: response,
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      mensaje: "Error al obtener los atributos del producto.",
      error: error.message,
    });
  }
});

atributo.delete("/:atributoId", verifyToken(jwtSecret), async (req, res) => {
  const startTime = performance.now();

  let dbConnection;

  try {
    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await deleteAtributo(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
    if (dbConnection) dbConnection.end();
  }
});

atributo.get("/:atributoId", verifyToken(jwtSecret), async (req, res) => {
  const startTime = performance.now();

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
    logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
    if (dbConnection) dbConnection.end();
  }
});

atributo.get("/", verifyToken(jwtSecret), async (req, res) => {
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