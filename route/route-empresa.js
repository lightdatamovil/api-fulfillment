import { Router } from "express";
const empresa = Router();
import Empresa from "../controller/empresa/empresa";
import { guardarEmpresasMap } from "../fuctions/empresaMap";
import { getFFProductionDbConfig } from "lightdata-tools";
import { hostFulFillement, portFulFillement } from "../db";

empresa.post("/empresa", async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

  try {
    if (data.operador === "eliminar") {
      const empresa = new Empresa();
      const response = await empresa.delete(connection, data.did);
      return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response,
      });
    } else {
      const nuevaEmpresa = new Empresa(
        data.did ?? 0,
        data.nombre,
        data.codigo,
        data.tipo ?? 1,
        data.superado ?? 0,
        data.elim ?? 0,
        connection
      );

      const empresaResult = await nuevaEmpresa.insert();
      const empresaId = empresaResult.insertId;

      global.empresasCodigos[data.codigo] = { did: data.idEmpresa };
      guardarEmpresasMap();

      return res.status(200).json({
        estado: true,
        message: "Empresa creada correctamente",
        didEmpresa: empresaId,
      });
    }
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
empresa.post("/deleteEmpresa", async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  try {
    const empresa = new Empresa();
    const response = await empresa.delete(connection, data.did);
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

export default empresa;
