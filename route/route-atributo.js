const express = require("express");
const atributo = express.Router();

const {
  redisClient,
  getConnection,
  getCompanyById,
  getConnectionLocal,
} = require("../dbconfig");

const { logRed } = require("../fuctions/logsCustom");

const Atributo = require("../controller/producto/atributos");
const Atributo_valor = require("../controller/producto/atributo_valor");
const { log } = require("node:console");

atributo.post("/postAtributo", async (req, res) => {
  try {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    console.log("data", data);

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
    console.log("atributo", atributo);

    const response = await atributo.insert();

    for (const valor of data.valores) {
      const atributoValor = new Atributo_valor(
        valor.did ?? 0,
        data.did == 0 ? response.insertId : data.did,
        valor.valor,
        data.orden,
        data.habilitado ?? 1,
        valor.codigo,
        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection
      );
      const respuesta = await atributoValor.insert();
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
    console.error("Error en /atributos:", error);
    return res.status(500).json({
      estado: false,
      mensaje: "Error al obtener los atributos del producto.",
      error: error.message,
    });
  }
});

atributo.post("/deleteAtributo", async (req, res) => {
  try {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    console.log("data", data);

    const atributo = new Atributo();
    const response = await atributo.delete(connection, data.did);

    return res.status(200).json({
      estado: true,
      atributo: response,
    });
  } catch (error) {
    console.error("Error en /eliminar:", error);
    return res.status(500).json({
      estado: false,
      mensaje: "Error al eliminar los atributos del producto.",
      error: error.message,
    });
  }
});

atributo.post("/getAtributoById", async (req, res) => {
  try {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const atributo = new Atributo();
    const response = await atributo.getAll(connection, data.did);
    console.log(response, "rerererer");

    return res.status(200).json({
      estado: true,
      data: response[0],
    });
  } catch (error) {
    console.error("Error en /getAtributos:", error);
    return res.status(500).json({
      estado: false,
      mensaje: "Ocurrió un error al obtener los atributos",
      error: error.message,
    });
  }
});
atributo.post("/getAtributos", async (req, res) => {
  try {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const atributo = new Atributo();
    const response = await atributo.getAtributos(connection, data);

    console.log("response", response);

    return res.status(200).json({
      estado: true,
      totalRegistros: response["totalRegistros"],
      totalPaginas: response["totalPaginas"],
      pagina: response["pagina"],
      cantidad: response["cantidad"],
      data: response["atributos"],
    });
  } catch (error) {
    console.error("Error en /getAtributos:", error);
    return res.status(500).json({
      estado: false,
      mensaje: "Ocurrió un error al obtener los atributos",
      error: error.message,
    });
  }
});
atributo.post("/getAtributosTotal", async (req, res) => {
  try {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const atributo = new Atributo();
    const response = await atributo.getAllFull(connection);

    return res.status(200).json({
      estado: true,
      data: response,
    });
  } catch (error) {
    console.error("Error en /getAtributos:", error);
    return res.status(500).json({
      estado: false,
      mensaje: "Ocurrio un error al obtener los atributos",
      error: error.message,
    });
  }
});

atributo.get("/", async (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

module.exports = atributo;
