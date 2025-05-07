const Cliente = require("../controller/cliente/cliente");

const ClienteContacto = require("../controller/cliente/cliente_contacto");
const ClienteDireccion = require("../controller/cliente/cliente_direccion");
const express = require("express");
const cliente = express.Router();

const {
  redisClient,
  getConnection,
  getCompanyById,
  getConnectionLocal,
} = require("../dbconfig");

cliente.post("/postCliente", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
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
    let clienteId = clienteResult.insertId;
    if (clienteResult.estado === false) {
      return res.status(400).json(clienteResult);
    }

    if (data.did > 0) {
      clienteId = data.did;
    }
    console.log(clienteResult, "Cliente Result");

    // Insertar direcciones
    if (Array.isArray(data.direccion)) {
      console.log("Direcciones:", data.direccion);

      for (const dir of data.direccion) {
        if (dir.did > 0) {
          clienteId = dir.did;
        }
        const direccion = new ClienteDireccion(
          dir.did ?? 0,
          clienteId, // didCliente
          dir.data ?? "",
          data.quien ?? 0,
          0,
          0,
          connection
        );
        await direccion.insert();
      }
    }

    // Insertar contactos
    if (Array.isArray(data.contacto)) {
      console.log("Contactos:", data.contacto);
      for (const cont of data.contacto) {
        const contacto = new ClienteContacto(
          cont.did ?? 0,
          clienteId, // diCliente
          cont.tipo ?? 0,
          cont.valor ?? "",
          data.quien ?? 0,
          0,
          0,
          connection
        );
        console.log("Contacto:", contacto);

        const contactoResult = await contacto.insert();
        console.log("Contacto Result:", contactoResult);
      }
    }

    return res.status(200).json({
      estado: true,
      message: "Cliente creado correctamente",
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
