const express = require("express");
const usuario = express.Router();
const { getConnectionLocal, } = require("../dbconfig");
const Usuario = require("../controller/usuario/usuario");
const verificarToken = require("../middleware/token");

usuario.post("/postUsuario", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    const usuarioRegex = /^[a-zA-Z0-9_]+$/; // Solo permite letras, números y guion bajo
    if (!usuarioRegex.test(data.usuario)) {
      return res.status(200).json({
        estado: false,
        message:
          "El campo 'usuario' no puede contener caracteres especiales ni espacios.",
      });
    }

    // Crear nuevo producto
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

    console.log(data.contraseña, "contraseña");

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

usuario.post("/login", async (req, res) => {
  const data = req.body;

  const empresaInfo = global.empresasCodigos[data.e];

  console.log("empresaInfo", empresaInfo.did);

  if (!empresaInfo || !empresaInfo.did) {
    return res.status(401).json({
      estado: false,
      message: "Código de empresa inválido o no registrado.",
    });
  }

  const connection = await getConnectionLocal(empresaInfo.did);
  const usuario = new Usuario();

  try {
    const response = await usuario.login(connection, data.u, data.p, data.e);

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

usuario.post("/getUsuarios", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const usuario = new Usuario();

  try {
    // Filtros dinámicos desde el body
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

    const response = await Usuario.getUsuarios(connection, filtros);

    return res.status(200).json({
      estado: true,
      totalRegistros: response["totalRegistros"],
      totalPaginas: response["totalPaginas"],
      pagina: response["pagina"],
      cantidad: response["cantidad"],
      data: response["usuarios"],
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

usuario.post("/getUsuarioById", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const usuario = new Usuario();

  try {
    const response = await Usuario.getUsuariosById(connection, data.did);

    return res.status(200).json({
      estado: true,
      data: response[0],
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

usuario.post("/deleteUsuario", verificarToken, async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    const usuario = new Usuario();
    const response = await usuario.delete(connection, data.did);
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

usuario.get("/", async (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

module.exports = usuario;
