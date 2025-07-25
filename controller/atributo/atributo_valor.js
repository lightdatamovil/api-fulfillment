const e = require("cors");
const { executeQuery } = require("../../dbconfig");

class Atributo_valor {
  constructor(
    did = "",
    didAtributo = 0,
    valor = "",
    orden = 0,
    habilitado = 0,
    codigo = "",
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.didAtributo = didAtributo || 0;
    this.valor = valor || "";
    this.orden = orden || 0;
    this.habilitado = habilitado || 1;
    this.codigo = codigo || "";
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
      const checkDidProductoQuery =
        "SELECT id FROM atributos_valores WHERE did = ?";
      const results = await executeQuery(connection, checkDidProductoQuery, [
        this.did,
      ]);

      if (results.length > 0) {
        const updateQuery =
          "UPDATE atributos_valores SET superado = 1 WHERE did = ?";

        await executeQuery(connection, updateQuery, [this.did]);

        const querydel =
          "select * from atributos_valores where didAtributo  = ? and superado = 0 and elim = 0";

        const results = await executeQuery(connection, querydel, [
          this.didAtributo,
        ]);

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
      const querycheck =
        "SELECT codigo FROM atributos_valores WHERE codigo = ? and superado = 0 and elim = 0";
      const resultscheck = await executeQuery(this.connection, querycheck, [
        this.codigo,
      ]);
      console.log("resultscheck", resultscheck);

      if (resultscheck.length > 0) {
        return {
          estado: false,
          message: "El codigo del atributo valor ya existe.",
        };
      }
      const columnsQuery = "DESCRIBE atributos_valores";
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter(
        (column) => this[column] !== undefined
      );

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO atributos_valores (${filteredColumns.join(
        ", "
      )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

      const insertResult = await executeQuery(connection, insertQuery, values);

      if (this.did == 0 || this.did == null) {
        const updateQuery = "UPDATE atributos_valores SET did = ? WHERE id = ?";
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
      const deleteQuery = "UPDATE atributos_valores SET elim = 1 WHERE did = ?";
      await executeQuery(connection, deleteQuery, [did]);
      return {
        estado: true,
        message: "atributo eliminado correctamente.",
      };
    } catch (error) {
      throw error;
    }
  }

  async getAll(connection) {
    try {
      const selectQuery =
        "SELECT * FROM atributos_valores WHERE elim = 0 and superado = 0 order by did asc";
      const results = await executeQuery(connection, selectQuery, []);
      return results;
    } catch (error) {
      throw error;
    }
  }

  async deleteMissing(connection, didAtributo, didsActuales = []) {
    try {
      if (!Array.isArray(didsActuales)) {
        didsActuales = [];
      }

      let deleteQuery = "";
      let params = [];

      if (didsActuales.length > 0) {
        deleteQuery = `
        UPDATE atributos_valores
        SET elim = 1
        WHERE didAtributo = ? AND did NOT IN (${didsActuales
            .map(() => "?")
            .join(", ")}) AND elim = 0
      `;
        params = [didAtributo, ...didsActuales];
      } else {
        // Si el array está vacío, eliminar todos los registros del atributo
        deleteQuery = `
        UPDATE atributos_valores
        SET elim = 1
        WHERE didAtributo = ? AND elim = 0
      `;
        params = [didAtributo];
      }

      await executeQuery(connection, deleteQuery, params);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Atributo_valor;
