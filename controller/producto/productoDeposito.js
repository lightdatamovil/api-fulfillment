const { executeQuery } = require("lightdata-tools");

class ProductoDeposito {
  constructor(
    did = "",
    didProducto = 0,
    didDeposito = 0,
    habilitado = 0,
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.didProducto = didProducto;
    this.didDeposito = didDeposito;
    this.habilitado = habilitado;
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
      if (this.did === null || this.did === "" || this.did === 0) {
        return this.createNewRecord(this.connection);
      } else {


        return this.checkAndUpdateDidProductoDeposito(this.connection);
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

  async checkAndUpdateDidProductoDeposito(connection) {

    const checkDidProductoDepositoQuery = 'SELECT did,habilitado FROM productos_depositos WHERE didDeposito = ? AND didProducto = ? AND elim = 0 AND superado = 0';
    const results = await executeQuery(connection, checkDidProductoDepositoQuery, [this.didDeposito, this.didProducto], true);

    if (results.length > 0) {


      const updateQuery = 'UPDATE productos_depositos SET superado = 1 WHERE didDeposito = ? AND didProducto = ?';
      await executeQuery(connection, updateQuery, [this.did, this.didProducto]);


      return this.createNewRecord2(connection, results[0].did);
    } else {
      return this.createNewRecord(connection);

    }

  }

  async createNewRecord(connection) {
    const columnsQuery = 'DESCRIBE productos_depositos';
    const results = await executeQuery(connection, columnsQuery, []);

    const tableColumns = results.map((column) => column.Field);
    const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

    const values = filteredColumns.map((column) => this[column]);
    const insertQuery = `INSERT INTO productos_depositos (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;

    const insertResult = await executeQuery(connection, insertQuery, values);

    if (this.did == 0 || this.did == null) {
      const updateQuery = 'UPDATE productos_depositos SET did = ? WHERE id = ?';
      await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
    }

    return { insertId: insertResult.insertId };
  }
  async createNewRecord2(connection, did2) {
    const columnsQuery = 'DESCRIBE productos_depositos';
    const results = await executeQuery(connection, columnsQuery, []);

    const tableColumns = results.map((column) => column.Field);
    const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

    const values = filteredColumns.map((column) => this[column]);
    const insertQuery = `INSERT INTO productos_depositos (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;

    const insertResult = await executeQuery(connection, insertQuery, values);




    const updateQuery = 'UPDATE productos_depositos SET did = ? WHERE id = ?';
    await executeQuery(connection, updateQuery, [did2, insertResult.insertId]);


    return { success: true, insertId: insertResult.insertId };
  }

  async delete() {
    const deleteQuery = 'UPDATE productos_depositos SET elim = 1 WHERE did = ?';
    await executeQuery(this.connection, deleteQuery, [this.did]);
  }
}

module.exports = ProductoDeposito;
