const { getConnection, executeQuery } = require('../../dbconfig');

class ProductoCombo {
  constructor(
    did = "",
    didProducto = 0,
    cantidad = 0,
    quien = 0,
    superado = 0,
    elim = 0,
    combo = {},
    connection = null

  ) {
    this.did = did;
    this.didProducto = didProducto;
    this.cantidad = cantidad;
    this.quien = quien || 0;
    this.superado = superado;
    this.elim = elim;
    this.combo = combo;
    this.connection = connection;
  }

  toJSON() {
    return JSON.stringify(this);
  }

  async insert() {
    try {
      if (this.did === null || this.did === "" || this.did == 0) {
        return this.createNewRecord(this.connection);
      } else {
        return this.checkAndUpdateDidProductoCombo(this.connection);
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

  async checkAndUpdateDidProductoCombo(connection) {
    try {
      const checkDidProductoComboQuery = 'SELECT id FROM productos_combos WHERE did = ?';
      const results = await executeQuery(connection, checkDidProductoComboQuery, [this.did]);

      if (results.length > 0) {
        const updateQuery = 'UPDATE productos_combos SET superado = 1 WHERE did = ?';
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
      const columnsQuery = 'DESCRIBE productos_combos';
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO productos_combos (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      
      const insertResult = await executeQuery(connection, insertQuery, values);
      
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE productos_combos SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }


  async delete() {
    try {
      const deleteQuery = 'UPDATE productos_combos SET elim = 1 WHERE did = ?';
      await executeQuery(this.connection, deleteQuery, [this.did]);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ProductoCombo;
