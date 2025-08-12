import { Router } from "express";
import verificarToken from "../middleware/token";
import Insumo from "../controller/insumo/insumos";
import { getFFProductionDbConfig, verifyToken } from "lightdata-tools";
import { hostFulFillement, portFulFillement } from "../db";

const insumo = Router();

insumo.post("/", verifyToken, async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

  try {
    const insumo = new Insumo(
      data.did || "",
      data.nombre,
      data.didCliente,
      data.codigo,
      data.clientes,
      data.unidad,
      data.habilitado,
      data.quien,
      data.superado || 0,
      data.elim || 0,
      connection
    );
    const insumoResult = await insumo.insert();

    if (insumoResult.estado === false) {
      return res.status(400).json({
        estado: false,
        message: insumoResult.message || insumoResult,
      });
    }
    const insumoId = insumoResult.insertId;

    return res.status(200).json({
      estado: true,
      message: "Insumo creado correctamente",
      didInsumo: insumoId,
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

insumo.post("/getInsumos", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const { pagina, cantidad, nombre, habilitado, codigo, did, didCliente } =
    data;
  const insumo = new Insumo();
  try {
    const response = await insumo.getInsumos(connection, {
      pagina: pagina || 1,
      cantidad: cantidad || 10,
      nombre: nombre || "",
      habilitado: habilitado || "",
      codigo: codigo || "",
      did: did || "",
      didCliente: didCliente || "",
    });
    if (response.estado === false) {
      return res.status(400).json({
        estado: false,
        message: response.message || response,
      });
    }

    return res.status(200).json({
      estado: true,
      totalRegistros: response["totalRegistros"],
      totalPaginas: response["totalPaginas"],
      pagina: response["pagina"],
      cantidad: response["cantidad"],
      data: response["data"],
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

insumo.post("/getInsumoById", async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const insumo = new Insumo();

  try {
    const response = await insumo.getInsumosById(connection, data.did);

    if (response.estado === false) {
      return res.status(400).json({
        estado: false,
        message: response.message || response,
      });
    }

    return res.status(200).json({
      estado: true,
      data: response[0],
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

insumo.post("/deleteInsumo", async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

  try {
    const insumo = new Insumo();
    const response = await insumo.delete(connection, data.did);

    return res.status(200).json({
      estado: response.estado !== undefined ? response.estado : false,
      message: response.message || response,
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

insumo.get("/getAllInsumos/:empresa", verificarToken, async (req, res) => {
  const empresa = req.params.empresa;

  if (!empresa) {
    return res.status(400).json({
      estado: false,
      error: "Falta el parámetro 'empresa'",
    });
  }

  const connection = getFFProductionDbConfig(empresa, hostFulFillement, portFulFillement);
  const insumo = new Insumo();

  try {
    const response = await insumo.getAll(connection);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

export default insumo;
