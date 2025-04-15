const e = require('cors');
const { getConnection, executeQuery } = require('../../dbconfig');

class Usuario {
  constructor(
    did = "",
    nombre = "",
    apellido = "",
    mail = "",
    pass  = "",
    imagen = "",
    habilitado = 0,
    perfil = 0,
    accesos="",
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.nombre = nombre;
    this.apellid = apellido;
    this.mail = mail;

    this.imagen = imagen;
    this.pass = pass;
    this.habilitado = habilitado;
    this.perfil = perfil;
    this.accesos = accesos ,
    this.quien = quien || 0;
    this.superado = superado || 0;
    this.elim = elim || 0;
    this.connection = connection;
  }

  toJSON() {
    return JSON.stringify(this);
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



async delete(connection,did) {
    try {
        const deleteQuery = 'UPDATE usuarios SET elim = 1 WHERE did = ?';
        await executeQuery(connection, deleteQuery, [did]);
        return {
            estado: true,
            message: "Producto eliminado correctamente."
        };
    }
    catch (error) {
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
    }
    );

    return usuariosSinPass;
  } catch (error) {
    console.error("Error en getUsuariosById:", error.message);
    throw error;
  }
}





}

module.exports =  Usuario; 
