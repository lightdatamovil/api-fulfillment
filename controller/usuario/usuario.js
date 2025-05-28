const crypto = require("crypto");
const crypt = require("unix-crypt-td-js");
const { getConnection, executeQuery } = require("../../dbconfig");
const { log } = require("console");
const jwt = require("jsonwebtoken");
const JWT_SECRET = "tu_clave_secreta";
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex"); // Generar un salt aleatorio
  const hashedPassword = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha256")
    .toString("hex");
  return `$5$${salt}$${hashedPassword}`;
}

class Usuario {
  constructor(
    did = "",
    nombre = "",
    apellido = "",
    mail = "",
    usuario = "",
    pass = "",
    imagen = "",
    habilitado = 0,
    perfiles = 0,
    accesos = "",
    modulo_inicial = 0,
    app_habilitada = 0,
    codigo_cliente = "",
    telefono = "",

    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.nombre = nombre;
    this.apellido = apellido;
    this.mail = mail;
    this.usuario = usuario;
    this.imagen = imagen;

    this.pass = pass;

    this.habilitado = habilitado;
    this.perfiles = perfiles;
    this.accesos = accesos;
    this.quien = quien || 0;
    this.modulo_inicial = modulo_inicial || 0;
    this.app_habilitada = app_habilitada || 0;
    this.codigo_cliente = codigo_cliente || "";
    this.telefono = telefono || "";

    this.superado = superado || 0;
    this.elim = elim || 0;
    this.connection = connection;
  }

  toJSON() {
    return JSON.stringify(this);
  }

  /*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Genera un hash de la contraseña dada, utilizando un salt aleatorio
   * y el algoritmo SHA-256.
   *
   * @param {string} password La contrase a a hashear
   * @return {string} El hash de la contrase a en formato $5$salt$hashedPassword
   */
  /*******  9568ac78-ef79-4fa5-90e6-27bb7b32be31  *******/
  hashPassword(password) {
    // Generar un salt aleatorio
    const salt = crypto.randomBytes(16).toString("hex");

    // Crear el hash de la contraseña usando SHA-256
    const hash = crypto
      .createHash("sha256")
      .update(password + salt)
      .digest("hex");

    // Formato de salida: $5$salt$hashedPassword
    return `$5$${salt}$${hash}`;
  }

  async insert() {
    try {
      if (this.did === null || this.did === "") {
        return this.createNewRecord(this.connection);
      } else {
        return this.checkAndUpdateDidProducto(this.connection);
      }
    } catch (error) {
      console.error("Error en el método insert:", error.message);
      throw {
        status: 500,
        response: {
          estado: false,
          error: -1,
        },
      };
    }
  }

  async checkAndUpdateDidProducto(connection) {
    try {
      const checkDidProductoQuery =
        "SELECT id, pass FROM usuarios WHERE did = ?";
      const results = await executeQuery(connection, checkDidProductoQuery, [
        this.did,
      ]);
      let pass;
      if (results.length > 0) {
        if (!this.pass) {
          pass = results[0].pass;
        }
        const updateQuery = "UPDATE usuarios SET superado = 1 WHERE did = ?";
        await executeQuery(connection, updateQuery, [this.did]);
        return this.createNewRecord(connection, pass);
      } else {
        return this.createNewRecord(connection, "");
      }
    } catch (error) {
      throw error;
    }
  }

  async createNewRecord(connection, pass) {
    try {
      const querycheck =
        "SELECT usuario FROM usuarios WHERE usuario = ? and superado = 0 and elim = 0";
      const resultscheck = await executeQuery(this.connection, querycheck, [
        this.usuario,
      ]);

      if (resultscheck.length > 0) {
        return {
          estado: false,
          message: "El usuario ya existe.",
        };
      }

      const columnsQuery = "DESCRIBE usuarios";
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter(
        (column) => this[column] !== undefined
      );

      // 🧂 Hasheamos la contraseña si está presente y no está ya en formato hash

      if (this.pass != "" || this.pass != null || this.pass != undefined) {
        const hash = crypto
          .createHash("sha256")
          .update(this.pass)
          .digest("hex");
        // Guardamos el salt y el hash
        this.pass = `${hash}`;
      }
      this.pass = pass;
      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO usuarios (${filteredColumns.join(
        ", "
      )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

      const insertResult = await executeQuery(connection, insertQuery, values);

      if (this.did == 0 || this.did == null) {
        const updateQuery = "UPDATE usuarios SET did = ? WHERE id = ?";
        await executeQuery(connection, updateQuery, [
          insertResult.insertId,
          insertResult.insertId,
        ]);
      }

      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }

  async delete(connection, did) {
    try {
      const deleteQuery = "UPDATE usuarios SET elim = 1 WHERE did = ?";
      await executeQuery(connection, deleteQuery, [did]);
      return {
        estado: true,
        message: "Producto eliminado correctamente.",
      };
    } catch (error) {
      throw error;
    }
  }

  static async getUsuarios(connection, filtros = {}) {
    try {
      let baseQuery = "FROM usuarios WHERE superado = 0 AND elim = 0";
      const params = [];
      const countParams = [];

      if (filtros.perfil !== undefined && filtros.perfil !== "") {
        baseQuery += " AND perfiles = ?";
        params.push(filtros.perfil);
        countParams.push(filtros.perfil);
      }

      if (filtros.nombre) {
        baseQuery += " AND nombre LIKE ?";
        params.push(`%${filtros.nombre}%`);
        countParams.push(`%${filtros.nombre}%`);
      }

      if (filtros.apellido) {
        baseQuery += " AND apellido LIKE ?";
        params.push(`%${filtros.apellido}%`);
        countParams.push(`%${filtros.apellido}%`);
      }

      if (filtros.email) {
        baseQuery += " AND mail LIKE ?";
        params.push(`%${filtros.email}%`);
        countParams.push(`%${filtros.email}%`);
      }
      if (filtros.usuario) {
        baseQuery += " AND usuario LIKE ?";
        params.push(`%${filtros.usuario}%`);
        countParams.push(`%${filtros.usuario}%`);
      }
      if (filtros.habilitado != "") {
        console.log(filtros.habilitado, "dsadsadas");

        baseQuery += " AND habilitado = ?";
        params.push(filtros.habilitado);
        countParams.push(filtros.habilitado);
      }

      // Paginación
      const pagina = parseInt(filtros.pagina) || 1;
      const porPagina = filtros.cantidad || 10;
      const offset = (pagina - 1) * porPagina;

      // Consulta principal con LIMIT
      const query = `SELECT did,perfiles as perfil,nombre,apellido,mail,usuario,habilitado,modulo_inicial, app_habilitada,telefono, codigo_cliente ${baseQuery} ORDER BY did DESC LIMIT ? OFFSET ?`;
      params.push(porPagina, offset);
      const results = await executeQuery(connection, query, params);

      // Consulta para contar total de usuarios con filtros
      const countQuery = `SELECT COUNT(*) AS total ${baseQuery}`;
      const countResult = await executeQuery(
        connection,
        countQuery,
        countParams
      );
      const totalRegistros = countResult[0]?.total || 0;
      const totalPaginas = Math.ceil(totalRegistros / porPagina);

      // Remover contraseña
      const usuariosSinPass = results.map((usuario) => {
        delete usuario.pass;
        return usuario;
      });

      return {
        usuarios: usuariosSinPass,
        pagina: pagina,
        totalRegistros,
        totalPaginas,
        cantidad: porPagina,
      };
    } catch (error) {
      console.error("Error en getUsuarios:", error.message);
      throw error;
    }
  }

  static async getUsuariosById(connection, id) {
    try {
      const query =
        "SELECT perfiles as perfil,nombre,apellido,mail,usuario,habilitado,did, modulo_inicial, app_habilitada,telefono, codigo_cliente FROM usuarios WHERE did = ? AND superado = 0 AND  elim = 0";
      const params = [id];
      const results = await executeQuery(connection, query, params);

      // Remover contraseña
      const usuariosSinPass = results.map((usuario) => {
        delete usuario.pass;
        return usuario;
      });

      return usuariosSinPass;
    } catch (error) {
      console.error("Error en getUsuariosById:", error.message);
      throw error;
    }
  }

  async login(connection, usuario, password, codigo = null) {
    try {
      const empresaQuery =
        "SELECT * FROM sistema_empresa WHERE codigo = ? AND superado = 0 AND elim = 0";
      const empresaResult = await executeQuery(connection, empresaQuery, [
        codigo,
      ]);

      if (empresaResult.length === 0) {
        return { estado: false, mensaje: "Código de empresa inválido" };
      }

      let query = `
      SELECT u.* 
      FROM usuarios u
      WHERE u.usuario = ? AND u.elim = 0 AND u.superado = 0 AND u.habilitado = 1
    `;
      const params = [usuario];

      if (codigo) {
        query +=
          " AND EXISTS (SELECT 1 FROM sistema_empresa se WHERE se.codigo = ?)";
        params.push(codigo);
      }

      const results = await executeQuery(connection, query, params);

      if (results.length === 0) {
        return {
          estado: false,
          mensaje: "Usuario no encontrado o código inválido",
        };
      }

      const user = results[0];

      // Verificamos que la contraseña hasheada esté en el formato correcto

      // Comparar la contraseña ingresada con la contraseña hasheada almacenada
      const hashCalculado = user.pass; // La contraseña ya está hasheada y almacenada

      // Aquí asumimos que la contraseña ingresada se compara directamente con el hash almacenado
      // Si el hashing es diferente, deberías implementar la lógica de comparación adecuada
      if (hashCalculado === password) {
        delete user.pass; // Eliminamos la contraseña del resultado para no exponerla

        // Generamos el JWT
        const token = jwt.sign(
          {
            did: user.did,
            perfil: user.perfil,
            nombre: user.nombre,
            apellido: user.apellido,
            mail: user.mail,
            username: user.usuario,
            quien: user.did,
            empresa: codigo,
            idEmpresa: empresaResult[0].did,
            tipo: empresaResult[0].tipo,
          },
          JWT_SECRET,
          {
            expiresIn: "4h", // duración del token
          }
        );

        return {
          estado: true,
          mensaje: "Login correcto",
          did: user.did,
          quien: user.did,
          perfil: user.perfil,
          nombre: user.nombre,
          apellido: user.apellido,
          mail: user.mail,
          username: user.usuario,
          empresa: codigo,
          didEmpresa: empresaResult[0].did,
          tipo: empresaResult[0].tipo,
          token: token,
        };
      } else {
        return { estado: false, mensaje: "Contraseña incorrecta" };
      }
    } catch (error) {
      console.error("Error en login:", error.message);
      throw error;
    }
  }
}

module.exports = Usuario;
