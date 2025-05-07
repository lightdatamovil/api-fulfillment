const { executeQuery } = require("../../dbconfig");

class Clente_contacto {
  constructor(
    did = "",
    didCliente = "",
    tipo = 0,
    valor = "",
    quien = 0,
    superado = 0,
    elim = 0,

    connection = null
  ) {
    this.did = did ?? 0;
    this.didCliente = didCliente;
    this.tipo = tipo || 0;
    this.valor = valor;
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
      if (this.did === null || this.did === "" || this.did === 0) {
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
      const checkQuery = "SELECT id FROM clientes_contactos WHERE did = ?";
      const results = await executeQuery(connection, checkQuery, [this.did]);
      if (results.length > 0) {
        const updateQuery =
          "UPDATE clientes_contactos SET superado = 1 WHERE did = ?";
        await executeQuery(connection, updateQuery, [this.did]);
        const querydel =
          "select * from clientes_contactos where didCliente = ? and superado = 0 and elim = 0";

        const results = await executeQuery(
          connection,
          querydel,
          [this.didCliente],
          true
        );
        console.log("RESULTS:", results);

        if (results.length > 0) {
          for (const row of results) {
            await this.delete(connection, row.did);
          }
        }

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
      const columnsQuery = "DESCRIBE clientes_contactos";
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter(
        (column) => this[column] !== undefined
      );

      const values = filteredColumns.map((column) => this[column]);

      const insertQuery = `INSERT INTO clientes_contactos (${filteredColumns.join(
        ", "
      )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

      const insertResult = await executeQuery(connection, insertQuery, values);

      if (this.did == 0 || this.did == null) {
        const updateQuery =
          "UPDATE clientes_contactos SET did = ? WHERE id = ?";
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
      const deleteQuery =
        "UPDATE clientes_contactos SET elim = 1 WHERE did = ?";
      await executeQuery(connection, deleteQuery, [did]);
      return {
        estado: true,
        message: "Cliente cuenta eliminado correctamente.",
      };
    } catch (error) {
      throw error;
    }
  }
  async deleteMissing(connection, didCliente, incomingDids = []) {
    try {
      const placeholders = incomingDids.length
        ? incomingDids.map(() => "?").join(", ")
        : "NULL";
      const deleteQuery = `
      UPDATE clientes_contactos 
      SET elim = 1 
      WHERE didCliente = ? 
      AND elim = 0
      ${incomingDids.length > 0 ? `AND did NOT IN (${placeholders})` : ""}
    `;

      const params = [didCliente, ...incomingDids];
      await executeQuery(connection, deleteQuery, params);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Clente_contacto;
