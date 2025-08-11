const express = require("express");
const empresa = express.Router();
const { getConnectionLocal } = require("../dbconfig").default;
const Empresa = require("../controller/empresa/empresa");
const { guardarEmpresasMap } = require("../fuctions/empresaMap");

empresa.post("/empresa", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    if (data.operador === "eliminar") {
      const empresa = new Empresa();
      const response = await empresa.delete(connection, data.did);
      return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response,
      });
    } else {
      // Crear nueva empresa
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

      // Agregar a variable global y guardar en JSON
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
empresa.post("deleteEmpresa", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
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

empresa.get("/", async (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

module.exports = empresa;
