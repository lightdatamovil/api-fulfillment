const express = require("express");
const usuario = express.Router();

const {
  redisClient,
  getConnection,
  getCompanyById,
  getConnectionLocal,
} = require("../dbconfig");
const Usuario = require("../controller/cliente/usuario");
const Cliente = require("../controller/cliente/cliente");
const Cliente_cuenta = require("../controller/cliente/cliente-cuenta");

usuario.post("/usuario", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    if (data.operador === "eliminar") {
      const usuario = new Usuario();
      const response = await usuario.delete(connection, data.did);
      console.log("Respuesta de delete:", response);
      return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response,
      });
    } else {
      const usuarioRegex = /^[a-zA-Z0-9_]+$/; // Solo permite letras, números y guion bajo
      if (!usuarioRegex.test(data.usuario)) {
        return res.status(400).json({
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
        data.contraseña,
        data.imagen,
        data.habilitado,
        data.perfil,
        data.accesos,
        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection
      );

      const usuarioResult = await usuario.insert();
      if (usuarioResult.estado === false) {
        return res.status(400).json({
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

usuario.post("/login", async (req, res) => {
  const data = req.body;

  const empresaInfo = global.empresasCodigos[data.e];

  if (!empresaInfo || !empresaInfo.did) {
    return res.status(400).json({
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
      usuario: response,
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

usuario.post("/getUsuarios", async (req, res) => {
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
      username: data.username,
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

usuario.post("/getUsuarioById", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const usuario = new Usuario();

  try {
    const response = await Usuario.getUsuariosById(connection, data.did);

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

usuario.post("/deleteUsuario", async (req, res) => {
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
