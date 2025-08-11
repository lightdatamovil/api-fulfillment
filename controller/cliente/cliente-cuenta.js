const { executeQuery } = require("lightdata-tools");

class Cliente_cuenta {
  constructor(
    did = "",
    didCliente = "",
    flex = 0,
    data = "",
    depositos = "",
    titulo = "",
    ml_id_vendedor = "",
    ml_user = "",
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did ?? 0;
    this.didCliente = didCliente;
    this.flex = flex || 0;
    this.data = data;
    this.depositos = depositos;
    this.titulo = titulo || "";
    this.ml_id_vendedor = ml_id_vendedor || "";
    this.ml_user = ml_user || "";
    this.quien = quien || 0;
    this.superado = superado || 0;
    this.elim = elim || 0;
    this.connection = connection;
  }

  static getTipoNombre(tipo) {
    const tipos = {
      1: "MercadoFlex",
      2: "Tienda Nube",
      3: "Shopify",
      4: "WooCommerce",
      5: "PrestaShop",
      6: "VTEX",
      7: "Falabella",
      8: "Jumpseller",
      9: "Aper",
    };
    return tipos[tipo] || "Desconocido";
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
    const checkQuery = "SELECT id FROM clientes_cuentas WHERE did = ?";
    const results = await executeQuery(connection, checkQuery, [this.did]);

    if (results.length > 0) {
      const updateQuery =
        "UPDATE clientes_cuentas SET superado = 1 WHERE did = ?";
      await executeQuery(connection, updateQuery, [this.did]);
      return this.createNewRecord(connection);
    } else {
      return this.createNewRecord(connection);
    }
  }

  async createNewRecord(connection) {
    const querycheck =
      "SELECT did FROM clientes WHERE did = ? and elim = 0 and superado = 0";
    const result = await executeQuery(connection, querycheck, [
      this.didCliente,
    ]);

    if (!Array.isArray(result) || result.length === 0) {
      return "El cliente no existe";
    }

    const columnsQuery = "DESCRIBE clientes_cuentas";
    const results = await executeQuery(connection, columnsQuery, []);

    const tableColumns = results.map((column) => column.Field);
    const filteredColumns = tableColumns.filter(
      (column) => this[column] !== undefined
    );

    const values = filteredColumns.map((column) => this[column]);

    const insertQuery = `INSERT INTO clientes_cuentas (${filteredColumns.join(
      ", "
    )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

    const insertResult = await executeQuery(connection, insertQuery, values);

    if (this.did == 0 || this.did == null) {
      const updateQuery = "UPDATE clientes_cuentas SET did = ? WHERE id = ?";
      await executeQuery(connection, updateQuery, [
        insertResult.insertId,
        insertResult.insertId,
      ]);
    }

    return { insertId: insertResult.insertId };
  }

  async delete(connection, did) {
    const deleteQuery = "UPDATE clientes_cuentas SET elim = 1 WHERE did = ?";
    await executeQuery(connection, deleteQuery, [did]);
    return {
      estado: true,
      message: "Cliente cuenta eliminado correctamente.",
    };
  }
  async deleteMissingFlex(connection, didCliente, incomingFlexIds = []) {
    const placeholders = incomingFlexIds.length
      ? incomingFlexIds.map(() => "?").join(", ")
      : "NULL";

    const deleteQuery = `
        UPDATE clientes_cuentas 
        SET elim = 1 
        WHERE didCliente = ? 
        AND elim = 0
        ${incomingFlexIds.length > 0 ? `AND flex NOT IN (${placeholders})` : ""}
      `;

    const params = [didCliente, ...incomingFlexIds];
    await executeQuery(connection, deleteQuery, params);
  }

  async getClientes(connection, filtros = {}) {
    try {
      const conditions = ["elim = 0 and superado = 0"];
      const values = [];

      // Filtros dinámicos
      if (filtros.didCliente) {
        conditions.push("didCliente = ?");
        values.push(filtros.didCliente);
      }

      if (filtros.ml_id_vendedor) {
        conditions.push("ml_id_vendedor = ?");
        values.push(filtros.ml_id_vendedor);
      }

      if (filtros.ml_user) {
        conditions.push("ml_user = ?");
        values.push(filtros.ml_user);
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      // Paginación
      const pagina = Number(filtros.pagina) || 1;
      const cantidadPorPagina = Number(filtros.cantidad) || 10;
      const offset = (pagina - 1) * cantidadPorPagina;

      // Total de registros
      const totalQuery = `SELECT COUNT(*) as total FROM clientes_cuentas ${whereClause}`;
      const totalResult = await executeQuery(connection, totalQuery, values);
      const totalRegistros = totalResult[0].total;
      const totalPaginas = Math.ceil(totalRegistros / cantidadPorPagina);

      // Consulta de datos
      const dataQuery = `
      SELECT * FROM clientes_cuentas
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
      const dataValues = [...values, cantidadPorPagina, offset];
      const results = await executeQuery(connection, dataQuery, dataValues);

      // Enriquecer los resultados
      const enriched = results.map((row) => ({
        ...row,
        tipo_nombre: Cliente_cuenta.getTipoNombre(row.tipo),
        data: row.data ? JSON.parse(row.data) : {},
      }));

      return {
        totalRegistros,
        totalPaginas,
        pagina,
        cantidad: cantidadPorPagina,
        clientes: enriched,
      };
    } catch (error) {
      console.error("Error en getClientes:", error.message);
      throw error;
    }
  }

  async getClientesById(connection, did) {
    try {
      const query = `SELECT * FROM clientes_cuentas WHERE did = ?`;
      const result = await executeQuery(connection, query, [did]);

      if (result.length === 0) {
        return "El clienteCuenta no existe"; // O lanzar un error si lo prefieres
      }

      const enrichedResult = {
        ...result[0],

        data: result[0].data ? JSON.parse(result[0].data) : {},
      };

      return enrichedResult;
    } catch (error) {
      console.error("Error en getClientesById:", error.message);
      throw error;
    }
  }
}

module.exports = Cliente_cuenta;
