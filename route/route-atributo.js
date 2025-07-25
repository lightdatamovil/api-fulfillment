const express = require("express");
const atributo = express.Router();
const {
  redisClient,
  getConnectionLocal,
} = require("../dbconfig");
const Atributo = require("../controller/atributo/atributos");
const Atributo_valor = require("../controller/atributo/atributo_valor");
const verificarToken = require("../middleware/token");

atributo.post("/postAtributo", verificarToken, async (req, res) => {
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

    const response = await atributo.insert();

    // Determinar did del atributo creado o existente
    const didAtributo = data.did == 0 ? response.insertId : data.did;

    // Borrar los valores que ya no están
    const helperValor = new Atributo_valor();
    const didsActuales = Array.isArray(data.valores)
      ? data.valores.map((v) => v.did).filter((d) => d > 0)
      : [];
    await helperValor.deleteMissing(connection, didAtributo, didsActuales);

    // Insertar los valores que vinieron
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
    console.error("Error en /atributos:", error);
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

atributo.post("/getAtributoById", verificarToken, async (req, res) => {
  try {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const atributo = new Atributo();
    const response = await atributo.getAll(connection, data.did);

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
atributo.post("/getAtributos", verificarToken, async (req, res) => {
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
atributo.get("/getAllAtributos/:empresa", verificarToken, async (req, res) => {
  try {
    const data = req.params;
    const connection = await getConnectionLocal(data.empresa);
    const atributo = new Atributo();
    const response = await atributo.getAllFull(connection);

    return res.status(200).json(response);
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
