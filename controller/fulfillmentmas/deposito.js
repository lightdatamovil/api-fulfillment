const e = require('cors');
const { getConnection, executeQuery } = require('../../dbconfig');

class Deposito {
  constructor(
    did = "",
    direccion = "",
    codigo = "",
    email = "",
    telefono = "",
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did?? 0;
    this.direccion = direccion || "";
    this.codigo = codigo || "";
    this.email = email || "";
    this.telefono = telefono || "";
    
    this.superado = superado || 0;
    this.elim = elim || 0;
    this.connection = connection;
  }

  toJSON() {
    return JSON.stringify(this);
  }

  async insert() {
    const querycheck = 'SELECT codigo FROM depositos WHERE codigo = ? and superado = 0 and elim = 0';
    const resultscheck = await executeQuery(this.connection, querycheck, [this.codigo]);
    if (resultscheck.length > 0) {
      return {
        estado: false,
        message: "El codigo del deposito ya existe.",
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
      const checkDidProductoQuery = 'SELECT id FROM depositos WHERE did = ?';
      const results = await executeQuery(connection, checkDidProductoQuery, [this.did]);

      if (results.length > 0) {
        const updateQuery = 'UPDATE depositos SET superado = 1 WHERE did = ?';
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
      const columnsQuery = 'DESCRIBE depositos';
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO depositos (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      
      const insertResult = await executeQuery(connection, insertQuery, values);
      
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE depositos SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }



async delete(connection,did) {
    try {
        const deleteQuery = 'UPDATE depositos SET elim = 1 WHERE did = ?';
        await executeQuery(connection, deleteQuery, [did]);
        return {
            estado: true,
            message: "Deposito eliminado correctamente."
        };
    }
    catch (error) {
        throw error;
    }
}







}

module.exports =  Deposito; 
