const e = require('cors');
const { getConnection, executeQuery } = require('../../dbconfig');

class Variante {
  constructor(
    did = "",
    didProducto = 0,
    sku = "",
    cantidad = 0,
   variante= "",
  
    habilitado = 0,
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.didProducto = didProducto || 0;
    this.sku = sku || "";
    this.cantidad = cantidad || 0;
    this.variante = variante || "";

    this.habilitado = habilitado || 1;
    this.quien = quien || 0;
    this.superado = superado;
    this.elim = elim;
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
      const checkDidProductoQuery = 'SELECT id FROM variantes WHERE did = ?';
      const results = await executeQuery(connection, checkDidProductoQuery, [this.did]);

      if (results.length > 0) {
        const updateQuery = 'UPDATE variantes SET superado = 1 WHERE did = ?';
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
      const columnsQuery = 'DESCRIBE variantes';
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO variantes (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      
      const insertResult = await executeQuery(connection, insertQuery, values);
      
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE variantes SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }


  async delete(connection,did) {
    try {
        const deleteQuery = 'UPDATE variantes SET elim = 1 WHERE did = ?';
        await executeQuery(connection, deleteQuery, [did]);
        return {
            estado: true,
            message: "Variante eliminado correctamente."
        };
    }
    catch (error) {
        throw error;
    }
}



}

module.exports =  Variante; ;
