const express = require("express");
const cliente = express.Router();

const {
  redisClient,
  getConnection,
  getCompanyById,
  getConnectionLocal,
} = require("../dbconfig");

const Cliente = require("../controller/cliente/cliente");

cliente.post("/postCliente", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    if (data.operador === "eliminar") {
      const cliente = new Cliente();
      const response = await cliente.delete(connection, data.did);
      console.log("Respuesta de delete:", response);
      return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response,
      });
    } else {
      // Crear nuevo producto
      const cliente = new Cliente(
        data.did ?? 0,
        data.nombre_fantasia,
        data.habilitado,

        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection
      );

      const clienteResult = await cliente.insert();

      const clienteId = clienteResult.insertId;

      return res.status(200).json({
        estado: true,
        message: "Cliente creado correctamente",
        didUsuario: clienteId,
      });
    }
  } catch (error) {
    console.error("Error durante la operación:", error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

cliente.post("/getClientes", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const filtros = {
    nombre_fantasia: data.nombre_fantasia ?? null,
    habilitado: data.habilitado ?? 2,
    pagina: data.pagina ?? 1,
    cantidad: data.cantidad ?? 10,
  };
  const cliente = new Cliente();
  try {
    const response = await cliente.getClientes(connection, filtros);
    return res.status(200).json({
      estado: true,
      totalRegistros: response["totalRegistros"],
      totalPaginas: response["totalPaginas"],
      pagina: response["pagina"],
      cantidad: response["cantidad"],
      data: response["clientes"],
    });
  } catch (error) {
    console.error("Error durante la operación:", error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

cliente.post("/getClienteById", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const cliente = new Cliente();

  try {
    const response = await cliente.getClientesById(connection, data.did);

    return res.status(200).json({
      estado: true,
      data: response,
    });
  } catch (error) {
    console.error("Error durante la operación:", error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});
cliente.post("/deleteCliente", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    const cliente = new Cliente();
    const response = await cliente.delete(connection, data.did);
    console.log("Respuesta de delete:", response);
    return res.status(200).json({
      estado: response.estado !== undefined ? response.estado : false,
      message: response.message || response,
    });
  } catch (error) {
    console.error("Error durante la operación:", error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

cliente.get("/getClientes/:empresa", async (req, res) => {
  const empresa = req.params.empresa; // <-- esto es lo correcto

  if (!empresa) {
    return res.status(400).json({
      estado: false,
      error: "Falta el parámetro 'empresa'",
    });
  }

  const connection = await getConnectionLocal(empresa);
  const cliente = new Cliente();

  try {
    const response = await cliente.getClienteF(connection);
    return res.status(200).json({
      estado: true,
      data: response,
    });
  } catch (error) {
    console.error("Error durante la operación:", error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

cliente.get("/", async (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

module.exports = cliente;
