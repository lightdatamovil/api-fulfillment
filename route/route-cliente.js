import Cliente from "../controller/cliente/cliente";
import ClienteContacto from "../controller/cliente/cliente_contacto";
import ClienteDireccion from "../controller/cliente/cliente_direccion";
import Cliente_cuenta from "../controller/cliente/cliente-cuenta";
import { Router } from "express";
import verificarToken from "../middleware/token";
import { getFFProductionDbConfig } from "lightdata-tools";
import { hostFulFillement, portFulFillement } from "../db";

const cliente = Router();

cliente.post("/postCliente", async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  let clienteId = 0;

  try {
    const cliente = new Cliente(
      data.did ?? 0,
      data.nombre_fantasia,
      data.habilitado,
      data.codigo,
      data.razon_social,
      data.observaciones,
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

    const cuentaHelper = new Cliente_cuenta();
    const cuentaFlexIds = Array.isArray(data.cuentas)
      ? data.cuentas.map((c) => c.flex).filter((flex) => flex > 0)
      : [];

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
          cuenta.titulo ?? "",
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
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const filtros = {
    nombre_fantasia: data.nombre_fantasia ?? null,
    razon_social: data.razon_social ?? null,
    codigo: data.codigo ?? null,

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
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const cliente = new Cliente();

  try {
    const response = await cliente.getClientesById(connection, data.did, data.idEmpresa);

    return res.status(200).json({
      estado: true,
      data: response,
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
cliente.post("/deleteCliente", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

  try {
    const cliente = new Cliente();
    const response = await cliente.delete(connection, data.did);
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

cliente.get("/getAllClientes/:empresa", verificarToken, async (req, res) => {
  const empresa = req.params.empresa;

  if (!empresa) {
    return res.status(400).json({
      estado: false,
      error: "Falta el parámetro 'empresa'",
    });
  }

  const connection = getFFProductionDbConfig(empresa, hostFulFillement, portFulFillement);
  const cliente = new Cliente();

  try {
    const response = await cliente.getAll(connection);
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

export default cliente;
