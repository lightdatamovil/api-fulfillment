const express = require("express");
const clienteCuentaR = express.Router();

const { getConnectionLocal } = require("../dbconfig");

const Cliente_cuenta = require("../controller/cliente/cliente-cuenta");
const verificarToken = require("../middleware/token");

clienteCuentaR.post("/clienteCuenta", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    // Si el operador es "eliminar"

    // Si es creación o actualización
    const clienteCuenta = new Cliente_cuenta(
      data.did ?? 0,
      data.diCliente,
      data.tipo,
      JSON.stringify(data.data ?? {}), // Importante: guardar como string JSON
      data.depositos ?? "",
      data.ml_id_vendedor ?? "",
      data.ml_user ?? "",
      data.quien ?? 0,
      data.superado ?? 0,
      data.elim ?? 0,
      connection
    );

    const clienteResult = await clienteCuenta.insert();

    const clienteId = clienteResult.insertId;

    return res.status(200).json({
      estado: true,
      message: clienteResult,
      didUsuario: clienteId,
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
clienteCuentaR.post(
  "/getClienteCuentaById",
  verificarToken,
  async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const clienteCuenta = new Cliente_cuenta();

    try {
      const response = await clienteCuenta.getClientesById(
        connection,
        data.did
      );

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
  }
);
clienteCuentaR.post("/getClientesCuentas", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const filtros = {
    diCliente: data.diCliente ?? null,
    ml_id_vendedor: data.ml_id_vendedor ?? null,
    ml_user: data.ml_user ?? null,
    pagina: data.pagina ?? 1,
    cantidad: data.cantidad ?? 10,
  };
  const cliente = new Cliente_cuenta();
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

clienteCuentaR.post(
  "/deleteClienteCuenta",
  verificarToken,
  async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
      const clienteCuenta = new Cliente_cuenta();
      const response = await clienteCuenta.delete(connection, data.did);
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
  }
);

clienteCuentaR.get("/", async (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

module.exports = clienteCuentaR;
