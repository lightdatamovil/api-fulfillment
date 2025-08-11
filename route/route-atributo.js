import { Router } from "express";
import Atributo from "../controller/atributo/atributos";
import Atributo_valor from "../controller/atributo/atributo_valor";
import verificarToken from "../middleware/token";
import { getFFProductionDbConfig } from "lightdata-tools";
import { hostFulFillement, hostFulFillementHost, portFulFillement } from "../db";

const atributo = Router();

atributo.post("/postAtributo", verificarToken, async (req, res) => {
  try {
    const data = req.body;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillementHost, portFulFillement);

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

atributo.post("/deleteAtributo", verificarToken, async (req, res) => {
  try {
    const data = req.body;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillementHost, portFulFillement);

    const atributo = new Atributo();
    const response = await atributo.delete(connection, data.did);

    return res.status(200).json({
      estado: true,
      atributo: response,
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      mensaje: "Error al eliminar los atributos del producto.",
      error: error.message,
    });
  }
});

atributo.post("/getAtributoById", verificarToken, async (req, res) => {
  try {
    const data = req.body;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillementHost, portFulFillement);
    const atributo = new Atributo();
    const response = await atributo.getAll(connection, data.did);

    return res.status(200).json({
      estado: true,
      data: response[0],
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      mensaje: "Ocurrió un error al obtener los atributos",
      error: error.message,
    });
  }
});
atributo.post("/getAtributos", verificarToken, async (req, res) => {
  try {
    const data = req.body;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillementHost, portFulFillement);
    const atributo = new Atributo();
    const response = await atributo.getAtributos(connection, data);

    return res.status(200).json({
      estado: true,
      totalRegistros: response["totalRegistros"],
      totalPaginas: response["totalPaginas"],
      pagina: response["pagina"],
      cantidad: response["cantidad"],
      data: response["atributos"],
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      mensaje: "Ocurrió un error al obtener los atributos",
      error: error.message,
    });
  }
});
atributo.get("/getAllAtributos/:empresa", verificarToken, async (req, res) => {
  try {
    const data = req.params;
    const connection = getFFProductionDbConfig(data.empresa, hostFulFillement, portFulFillement);
    const atributo = new Atributo();
    const response = await atributo.getAllFull(connection);

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      estado: false,
      mensaje: "Ocurrio un error al obtener los atributos",
      error: error.message,
    });
  }
});

export default atributo;
