const { executeQuery } = require("lightdata-tools");

class ProductoCombo {
  constructor(
    did = "",
    didProducto = 0,
    didProductoCombo = 0,
    cantidad = 0,

    combo = {},

    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.didProducto = didProducto;
    this.didProductoCombo = didProductoCombo;
    this.cantidad = cantidad;
    this.combo = JSON.stringify(combo);
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
    const checkDidProductoComboQuery =
      "SELECT did FROM productos_combos WHERE didProducto = ? and didProductoCombo = ? AND superado = 0 AND elim = 0";
    const results = await executeQuery(
      connection,
      checkDidProductoComboQuery,
      [this.didProducto, this.didProductoCombo],
      true
    );

    if (results.length > 0) {
      const updateQuery =
        "UPDATE productos_combos SET superado = 1 WHERE did = ?";
      await executeQuery(connection, updateQuery, [results[0].did]);

      return this.createNewRecord2(connection, [results[0].did]);
    } else {
      return this.createNewRecord(connection);
    }
  }

  async createNewRecord(connection) {
    const columnsQuery = "DESCRIBE productos_combos";
    const results = await executeQuery(connection, columnsQuery, []);

    const tableColumns = results.map((column) => column.Field);
    const filteredColumns = tableColumns.filter(
      (column) => this[column] !== undefined
    );

    const values = filteredColumns.map((column) => this[column]);
    const insertQuery = `INSERT INTO productos_combos (${filteredColumns.join(
      ", "
    )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

    const insertResult = await executeQuery(connection, insertQuery, values);

    if (this.did == 0 || this.did == null) {
      const updateQuery = "UPDATE productos_combos SET did = ? WHERE id = ?";
      await executeQuery(connection, updateQuery, [
        insertResult.insertId,
        insertResult.insertId,
      ]);
    }

    return { insertId: insertResult.insertId };
  }

  async createNewRecord2(connection, did) {
    const columnsQuery = "DESCRIBE productos_combos";
    const results = await executeQuery(connection, columnsQuery, []);

    const tableColumns = results.map((column) => column.Field);
    const filteredColumns = tableColumns.filter(
      (column) => this[column] !== undefined
    );

    const values = filteredColumns.map((column) => {
      const val = this[column];
      if (typeof val === "object" && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    });

    const insertQuery = `INSERT INTO productos_combos (${filteredColumns.join(
      ", "
    )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;
    const insertResult = await executeQuery(connection, insertQuery, values);

    const updateQuery = "UPDATE productos_combos SET did = ? WHERE id = ?";
    await executeQuery(connection, updateQuery, [did, insertResult.insertId]);

    return { insertId: insertResult.insertId };
  }

  async delete() {
    const deleteQuery = "UPDATE productos_combos SET elim = 1 WHERE did = ?";
    await executeQuery(this.connection, deleteQuery, [this.did]);
  }

  async deleteMissing(connection, didAtributo, didsActuales = []) {
    if (!Array.isArray(didsActuales)) {
      didsActuales = [];
    }

    let deleteQuery = "";
    let params = [];

    if (didsActuales.length > 0) {
      deleteQuery = `
        UPDATE productos_combos
        SET elim = 1
        WHERE didProducto = ? AND did NOT IN (${didsActuales
          .map(() => "?")
          .join(", ")}) AND elim = 0
      `;
      params = [didAtributo, ...didsActuales];
    } else {
      // Si el array está vacío, eliminar todos los registros del atributo
      deleteQuery = `
        UPDATE productos_combos
        SET elim = 1
        WHERE didProducto = ? AND elim = 0
      `;
      params = [didAtributo];
    }

    await executeQuery(connection, deleteQuery, params);
  }
}

module.exports = ProductoCombo;
