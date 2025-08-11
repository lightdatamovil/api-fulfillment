import { executeQuery } from "lightdata-tools";

class pedidoHistorial {
  constructor(
    didPedido = 0,
    estado = "",
    quien = 0,
    superado = 0,
    elim = "",
    connection = null,
  ) {
    this.didPedido = didPedido;
    this.estado = estado;
    this.superado = superado;
    this.elim = elim;
    this.quien = quien || 0;
    this.connection = connection
  }

  toJSON() {
    return JSON.stringify(this);
  }

  async insert() {
    try {

      if (this.didOrden === null) {
        return this.createNewRecord(this.connection);
      } else {
        return this.checkAndUpdateDidEnvio(this.connection);
      }
    } catch (error) {

      throw {
        status: 500,
        response: {
          estado: false,
          error: -1,
        },
      };
    }
  }

  async checkAndUpdateDidEnvio(connection) {
    const checkDidEnvioQuery = 'SELECT id FROM  pedidos_historial WHERE didOrden =?';

    const results = await executeQuery(connection, checkDidEnvioQuery, [this.didOrden]);

    if (results.length > 0) {

      const updateQuery = 'UPDATE  pedidos_historial SET superado = 1 WHERE didOrden = ?';
      await executeQuery(connection, updateQuery, [this.didOrden]);
      const updateQuery2 = 'UPDATE  pedidos SET status= ? WHERE did = ? ';
      await executeQuery(connection, updateQuery2, [this.estado, this.didOrden]);

      return this.createNewRecord(connection);
    } else {
      return this.createNewRecord(connection);
    }
  }

  async createNewRecord(connection) {
    const columnsQuery = 'DESCRIBE  pedidos_historial';

    const results = await executeQuery(connection, columnsQuery, []);

    const tableColumns = results.map((column) => column.Field);
    const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

    const values = filteredColumns.map((column) => this[column]);
    const insertQuery = `INSERT INTO  pedidos_historial (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;

    const insertResult = await executeQuery(connection, insertQuery, values);

    return { insertId: insertResult.insertId };
  }



  async eliminar(connection, did) {
    const deleteQuery = 'UPDATE pedidos_historial set elim = 1 WHERE did = ?';
    await executeQuery(connection, deleteQuery, [did]);

  }

  async getAll(connection, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const selectQuery = `
        SELECT * FROM fulfillment_insumos 
        WHERE elim = 0 AND superado = 0 
        LIMIT ? OFFSET ?
      `;
    const results = await executeQuery(connection, selectQuery, [limit, offset]);

    const countQuery = `
        SELECT COUNT(*) AS total FROM fulfillment_insumos 
        WHERE elim = 0 AND superado = 0
      `;
    const countResult = await executeQuery(connection, countQuery);
    const total = countResult[0].total;

    const totalPages = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPages,
      items: results
    };
  }

}
export default pedidoHistorial;