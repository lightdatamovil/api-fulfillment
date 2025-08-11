import { Router } from "express";
import Usuario from "../controller/usuario/usuario";
import verificarToken from "../middleware/token";
import { getFFProductionDbConfig } from "lightdata-tools";
import { hostFulFillement, portFulFillement } from "../db";

const usuario = Router();

usuario.post("/postUsuario", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

  try {
    const usuarioRegex = /^[a-zA-Z0-9_]+$/;
    if (!usuarioRegex.test(data.usuario)) {
      return res.status(200).json({
        estado: false,
        message:
          "El campo 'usuario' no puede contener caracteres especiales ni espacios.",
      });
    }

    const usuario = new Usuario(
      data.did ?? 0,
      data.nombre,
      data.apellido,
      data.mail,
      data.usuario,
      data.contraseña ?? "",
      data.imagen,
      data.habilitado,
      data.perfil,
      data.accesos,
      data.modulo_inicial ?? 0,
      data.app_habilitada ?? 0,
      data.codigo_cliente ?? "",
      data.telefono ?? "",
      data.quien,
      data.superado ?? 0,
      data.elim ?? 0,
      connection
    );


    const usuarioResult = await usuario.insert();
    if (usuarioResult.estado === false) {
      return res.status(401).json({
        estado: false,
        message: usuarioResult.message || usuarioResult,
      });
    }
    const usuarioId = usuarioResult.insertId;

    return res.status(200).json({
      estado: true,
      message: "Usuario creado correctamente",
      didUsuario: usuarioId,
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

usuario.post("/login", async (req, res) => {
  const data = req.body;

  const empresaInfo = global.empresasCodigos[data.e];


  if (!empresaInfo || !empresaInfo.did) {
    return res.status(401).json({
      estado: false,
      message: "Código de empresa inválido o no registrado.",
    });
  }

  const connection = getFFProductionDbConfig(empresaInfo.did, hostFulFillement, portFulFillement);
  const usuario = new Usuario();

  try {
    const response = await usuario.login(connection, data.u, data.p, data.e);

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

usuario.post("/getUsuarios", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const usuario = new Usuario();

  try {
    const filtros = {
      did: data.did,
      perfil: data.perfil,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      pagina: data.pagina,
      usuario: data.usuario,
      habilitado: data.habilitado,
      cantidad: data.cantidad,


    };
    const didUsuario = data.didUsuario;
    const response = await usuario.getUsuarios(connection, didUsuario, filtros);

    return res.status(200).json({
      estado: true,
      totalRegistros: response["totalRegistros"],
      totalPaginas: response["totalPaginas"],
      pagina: response["pagina"],
      cantidad: response["cantidad"],
      data: response["usuarios"],
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

usuario.post("/getUsuarioById", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const usuario = new Usuario();

  try {
    const response = await usuario.getUsuariosById(connection, data.did);

    return res.status(200).json({
      estado: true,
      data: response[0],
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

usuario.post("/deleteUsuario", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

  try {
    const usuario = new Usuario();
    const response = await usuario.delete(connection, data.did);
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

export default usuario;
