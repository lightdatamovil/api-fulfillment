const e = require('cors');
const { getConnection, executeQuery } = require('../../dbconfig');

class Cliente {
  constructor(
    did = "",
    nombre_fantasia = "",
    habilitado = 1,
  
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.nombre_fantasia = nombre_fantasia;
    this.habilitado = habilitado;
    this.quien = quien || 0;
    this.superado = superado || 0;
    this.elim = elim || 0;
    this.connection = connection;
  }

  toJSON() {
    return JSON.stringify(this);
  }

  async insert() {
    const querycheck = 'SELECT nombre_fantasia FROM clientes WHERE nombre_fantasia = ? and superado = 0 and elim = 0';
    const resultscheck = await executeQuery(this.connection, querycheck, [this.nombre_fantasia]);
    if (resultscheck.length > 0) {
      return {
        estado: false,
        message: "El cliente ya existe.",
      };
    }
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
      const checkDidProductoQuery = 'SELECT id FROM clientes WHERE did = ?';
      const results = await executeQuery(connection, checkDidProductoQuery, [this.did]);

      if (results.length > 0) {
        const updateQuery = 'UPDATE clientes SET superado = 1 WHERE did = ?';
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
      const columnsQuery = 'DESCRIBE clientes';
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO clientes (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      
      const insertResult = await executeQuery(connection, insertQuery, values);
      
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE clientes SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }



async delete(connection,did) {
    try {
        const deleteQuery = 'UPDATE clientes SET elim = 1 WHERE did = ?';
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
async getClientes(connection, did = null) {
  try {
    let query = 'SELECT * FROM clientes WHERE elim = 0';
    const params = [];

    if (did) {
      query += ' AND did = ?';
      params.push(did);
    }

    const results = await executeQuery(connection, query, params);

    // Quitar la contraseña de cada usuario
    const usuariosSinPass = results.map(usuario => {
      delete usuario.pass;
      return usuario;
    });

    return usuariosSinPass;
  } catch (error) {
    console.error("Error en GETCLIENTES:", error.message);
    throw error;
  }
}







}

module.exports =  Cliente; 
