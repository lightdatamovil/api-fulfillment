const crypto = require('crypto');
const { getConnection, executeQuery } = require('../../dbconfig');
const { log } = require('console');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex'); // Generar un salt aleatorio
  const hashedPassword = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
  return `$5$${salt}$${hashedPassword}`;
}

class Usuario {
  constructor(
    did = "",
    nombre = "",
    apellido = "",
    mail = "",
    usuario="",
    pass = "",
    imagen = "",
    habilitado = 0,
    perfil = 0,
    accesos = "",
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.nombre = nombre;
    this.apellid = apellido;
    this.mail = mail;
    this.usuario = usuario;
    this.imagen = imagen;
    this.pass = pass;
    this.habilitado = habilitado;
    this.perfil = perfil;
    this.accesos = accesos;
    this.quien = quien || 0;
    this.superado = superado || 0;
    this.elim = elim || 0;
    this.connection = connection;
  }

  toJSON() {
    return JSON.stringify(this);
  }

   async hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex'); // Generar un salt aleatorio
    const hashedPassword = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
    return `$5$${salt}$${hashedPassword}`;
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
      const checkDidProductoQuery = 'SELECT id FROM usuarios WHERE did = ?';
      const results = await executeQuery(connection, checkDidProductoQuery, [this.did]);

      if (results.length > 0) {
        const updateQuery = 'UPDATE usuarios SET superado = 1 WHERE did = ?';
        await executeQuery(connection, updateQuery, [this.did]);
        return this.createNewRecord(connection);
      } else {
        return this.createNewRecord(connection);
      }
    } catch (error) {
      throw error;
    }
  }

  async createNewRecord(connection) {
    try {
      const columnsQuery = 'DESCRIBE usuarios';
      const results = await executeQuery(connection, columnsQuery, []);
  
      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);
  
      // 🧂 Hasheamos la contraseña si está presente y no está ya en formato $5$
      if (this.pass && !this.pass.startsWith('$5$')) {
        this.pass = hashPassword(this.pass); // Usamos hashPassword aquí
      }
  
      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO usuarios (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
  
      const insertResult = await executeQuery(connection, insertQuery, values);
  
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE usuarios SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
  
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }

  async delete(connection, did) {
    try {
      const deleteQuery = 'UPDATE usuarios SET elim = 1 WHERE did = ?';
      await executeQuery(connection, deleteQuery, [did]);
      return {
        estado: true,
        message: "Producto eliminado correctamente."
      };
    } catch (error) {
      throw error;
    }
  }

  static async getUsuarios(connection, filtros = {}) {
    try {
      let baseQuery = 'FROM usuarios WHERE superado = 0 AND elim = 0';
      const params = [];
      const countParams = [];

      if (filtros.perfil !== undefined && filtros.perfil !== "") {
        baseQuery += ' AND perfiles = ?';
        params.push(filtros.perfil);
        countParams.push(filtros.perfil);
      }

      if (filtros.nombre) {
        baseQuery += ' AND nombre LIKE ?';
        params.push(`%${filtros.nombre}%`);
        countParams.push(`%${filtros.nombre}%`);
      }

      if (filtros.apellido) {
        baseQuery += ' AND apellido LIKE ?';
        params.push(`%${filtros.apellido}%`);
        countParams.push(`%${filtros.apellido}%`);
      }

      if (filtros.email) {
        baseQuery += ' AND mail LIKE ?';
        params.push(`%${filtros.email}%`);
        countParams.push(`%${filtros.email}%`);
      }

      // Paginación
      const pagina = parseInt(filtros.pagina) || 1;
      const porPagina = 20;
      const offset = (pagina - 1) * porPagina;

      // Consulta principal con LIMIT
      const query = `SELECT perfiles,nombre,apellido,mail,usuario,habilitado ${baseQuery} LIMIT ? OFFSET ?`;
      params.push(porPagina, offset);
      const results = await executeQuery(connection, query, params);

      // Consulta para contar total de usuarios con filtros
      const countQuery = `SELECT COUNT(*) AS total ${baseQuery}`;
      const countResult = await executeQuery(connection, countQuery, countParams);
      const totalUsuarios = countResult[0]?.total || 0;
      const totalPaginas = Math.ceil(totalUsuarios / porPagina);

      // Remover contraseña
      const usuariosSinPass = results.map(usuario => {
        delete usuario.pass;
        return usuario;
      });

      return {
        usuarios: usuariosSinPass,
        paginaActual: pagina,
        totalUsuarios,
        totalPaginas
      };
    } catch (error) {
      console.error("Error en getUsuarios:", error.message);
      throw error;
    }
  }

  static async getUsuariosById(connection, id) {
    try {
      const query = 'SELECT perfiles,nombre,apellido,mail,usuario,habilitado FROM usuarios WHERE did = ? AND superado = 0 AND  elim = 0';
      const params = [id];
      const results = await executeQuery(connection, query, params);

      // Remover contraseña
      const usuariosSinPass = results.map(usuario => {
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
      // Primero verificamos si el código de la empresa existe en la tabla 'sistema_empresa'
      const empresaQuery = 'SELECT * FROM sistema_empresa WHERE codigo = ? ';
      const empresaResult = await executeQuery(connection, empresaQuery, [codigo]);
  
      // Si no existe el código de la empresa, retornamos un error
      if (empresaResult.length === 0) {
        return { estado: false, mensaje: 'Código de empresa inválido' };
      }
  
      // Si el código de la empresa es válido, continuamos con el proceso de login para el usuario
      let query = `
        SELECT u.* 
        FROM usuarios u
        WHERE u.usuario = ? AND u.elim = 0 AND u.superado = 0 AND u.habilitado = 1
      `;
      const params = [usuario];
  
      // Si el código es necesario para la validación, lo podemos agregar aquí (aunque no tiene relación directa con 'usuarios')
      if (codigo) {
        query += ' AND EXISTS (SELECT 1 FROM sistema_empresa se WHERE se.codigo = ?)';
        params.push(codigo);
      }
  
      console.log(query, params);  // Para depurar y ver cómo queda la consulta final
  
      const results = await executeQuery(connection, query, params);
  
      if (results.length === 0) {
        return { estado: false, mensaje: 'Usuario no encontrado o código inválido' };
      }
  
      const user = results[0];
  
      if (!user.pass || !user.pass.startsWith('$5$')) {
        return { estado: false, mensaje: 'Formato de contraseña inválido' };
      }
  
      const salt = user.pass.split('$')[2]; // Extraemos el salt
      const hashCalculado = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex'); // Calculamos el hash
  
      if (hashCalculado === user.pass.split('$')[3]) {
        delete user.pass; // Eliminamos la contraseña del resultado
        return { estado: true, mensaje: 'Login correcto', usuario: user };
      } else {
        return { estado: false, mensaje: 'Contraseña incorrecta' };
      }
    } catch (error) {
      console.error("Error en login:", error.message);
      throw error;
    }
  }
  
}

module.exports = Usuario;
