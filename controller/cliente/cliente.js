const e = require("cors");
const { getConnection, executeQuery } = require("../../dbconfig");

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
    const querycheck =
      "SELECT nombre_fantasia FROM clientes WHERE nombre_fantasia = ? and superado = 0 and elim = 0";
    const resultscheck = await executeQuery(this.connection, querycheck, [
      this.nombre_fantasia,
    ]);
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
      const checkDidProductoQuery = "SELECT id FROM clientes WHERE did = ?";
      const results = await executeQuery(connection, checkDidProductoQuery, [
        this.did,
      ]);

      if (results.length > 0) {
        const updateQuery = "UPDATE clientes SET superado = 1 WHERE did = ?";
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
      const columnsQuery = "DESCRIBE clientes";
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter(
        (column) => this[column] !== undefined
      );

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO clientes (${filteredColumns.join(
        ", "
      )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

      const insertResult = await executeQuery(connection, insertQuery, values);

      if (this.did == 0 || this.did == null) {
        const updateQuery = "UPDATE clientes SET did = ? WHERE id = ?";
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
      const deleteQuery = "UPDATE clientes SET elim = 1 WHERE did = ?";
      await executeQuery(connection, deleteQuery, [did]);
      return {
        estado: true,
        message: "Producto eliminado correctamente.",
      };
    } catch (error) {
      throw error;
    }
  }
  async getClientes(connection, filtros) {
    try {
      const conditions = ["elim = 0 and superado = 0"];
      const values = [];

      // Filtro habilitado (0: no habilitado, 1: habilitado, 2: todos)
      if (filtros.habilitado !== undefined && filtros.habilitado !== 2) {
        conditions.push("habilitado = ?");
        values.push(filtros.habilitado);
      }

      // Filtro nombre_fantasia
      if (filtros.nombre_fantasia) {
        conditions.push("nombre_fantasia LIKE ?");
        values.push(`%${filtros.nombre_fantasia}%`);
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      // Paginación
      const pagina = Number(filtros.pagina) || 1;
      const cantidadPorPagina = Number(filtros.cantidad) || 10;
      const offset = (pagina - 1) * cantidadPorPagina;

      // Consulta total
      const totalQuery = `SELECT COUNT(*) as total FROM clientes ${whereClause}`;
      const totalResult = await executeQuery(connection, totalQuery, values);
      const totalRegistros = totalResult[0].total;
      const totalPaginas = Math.ceil(totalRegistros / cantidadPorPagina);

      // Consulta paginada
      const dataQuery = `
      SELECT * FROM clientes
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
      const dataValues = [...values, cantidadPorPagina, offset];
      const results = await executeQuery(connection, dataQuery, dataValues);

      // Quitar contraseña
      const usuariosSinPass = results.map((usuario) => {
        delete usuario.pass;
        return usuario;
      });

      return {
        totalRegistros,
        totalPaginas,
        pagina,
        cantidad: cantidadPorPagina,
        clientes: usuariosSinPass,
      };
    } catch (error) {
      console.error("Error en GETCLIENTES:", error.message);
      throw error;
    }
  }

  async getClientesById(connection, did) {
    try {
      let query =
        "SELECT * FROM clientes WHERE elim = 0 and superado = 0 AND did = ?";

      const results = await executeQuery(connection, query, did);
      if (results.length === 0) {
        return {
          estado: false,
          message: "No se encontró el cliente.",
        };
      }
      // Quitar la contraseña de cada usuario
      const usuariosSinPass = results.map((usuario) => {
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

module.exports = Cliente;
