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
const verificarToken = require("../middleware/token");
const Cliente_cuenta = require("../controller/cliente/cliente-cuenta");

cliente.post("/postCliente", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  let clienteId = 0;

  try {
    // ------------------------------
    // ✅ CREACIÓN / ACTUALIZACIÓN CLIENTE
    // ------------------------------
    const cliente = new Cliente(
      data.did ?? 0,
      data.nombre_fantasia,
      data.habilitado,
      data.codigo,
      data.razon_social,
      data.quien,
      data.superado ?? 0,
      data.elim ?? 0,
      connection
    );

    const clienteResult = await cliente.insert();
    if (clienteResult.estado === false) {
      return res.status(401).json(clienteResult);
    }

    clienteId = data.did > 0 ? data.did : clienteResult.insertId;

    // ------------------------------
    // ✅ DIRECCIONES
    // ------------------------------
    const direccionHelper = new ClienteDireccion();
    const dirDids = Array.isArray(data.direcciones)
      ? data.direcciones.map((d) => d.did).filter((did) => did > 0)
      : [];
    await direccionHelper.deleteMissing(connection, clienteId, dirDids);

    if (Array.isArray(data.direcciones)) {
      for (const dir of data.direcciones) {
        const direccionData = JSON.stringify(dir.data ?? {});
        const direccion = new ClienteDireccion(
          dir.did ?? 0,
          clienteId,
          direccionData ?? "",
          data.quien ?? 0,
          0,
          0,
          connection
        );
        await direccion.insert();
      }
    }

    // ------------------------------
    // ✅ CONTACTOS
    // ------------------------------
    const contactoHelper = new ClienteContacto();
    const contDids = Array.isArray(data.contactos)
      ? data.contactos.map((c) => c.did).filter((did) => did > 0)
      : [];
    await contactoHelper.deleteMissing(connection, clienteId, contDids);

    if (Array.isArray(data.contactos)) {
      for (const cont of data.contactos) {
        const contacto = new ClienteContacto(
          cont.did ?? 0,
          clienteId,
          cont.tipo ?? 0,
          cont.valor ?? "",
          data.quien ?? 0,
          0,
          0,
          connection
        );
        await contacto.insert();
      }
    }
    console.log("data.cuenta", data.cuentas);

    // ------------------------------
    // ✅ CLIENTE CUENTA
    // ------------------------------
    const cuentaHelper = new Cliente_cuenta();
    const cuentaFlexIds = Array.isArray(data.cuentas)
      ? data.cuentas.map((c) => c.flex).filter((flex) => flex > 0)
      : [];

    // Verificar y eliminar cuentas que no tienen flex
    await cuentaHelper.deleteMissingFlex(connection, clienteId, cuentaFlexIds);

    if (Array.isArray(data.cuentas)) {
      for (const cuenta of data.cuentas) {
        const cuentaData = cuenta.data ?? {};
        const cuentaTipo = cuenta.tipo ?? 0;

        const clienteCuenta = new Cliente_cuenta(
          cuenta.did ?? 0,
          clienteId,
          cuentaTipo,
          JSON.stringify(cuentaData),
          cuenta.depositos ?? "",
          cuentaTipo === 1 ? cuentaData.ml_id_vendedor ?? "" : "",
          cuentaTipo === 1 ? cuentaData.ml_user ?? "" : "",
          data.quien ?? 0,
          data.superado ?? 0,
          data.elim ?? 0,
          connection
        );

        await clienteCuenta.insert();
      }
    }


    return res.status(200).json({
      estado: true,
      message: "Cliente completo creado correctamente",
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

cliente.post("/getClientes", verificarToken, async (req, res) => {
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
    const response = await cliente.getClientesById(connection, data.did, data.idEmpresa);

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
cliente.post("/deleteCliente", verificarToken, async (req, res) => {
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

cliente.get("/getAllClientes/:empresa", verificarToken, async (req, res) => {
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
    const response = await cliente.getAll(connection);
    return res.status(200).json(response);
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
