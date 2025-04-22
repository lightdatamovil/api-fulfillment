const e = require('cors');
const { getConnection, executeQuery } = require('../../dbconfig');

class Cliente_cuentaV {
  constructor(
    did = "",
    diCliente = "",
    tipo = 0,
    data = "",
    seller_id = "",
    username = "",
    depositos = "",

    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did?? 0;
    this.diCliente = diCliente;
    this.tipo = tipo || 0;

    this.data = data;

    this.seller_id = seller_id;
    this.username = username;
    this.depositos = depositos;
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
      const checkDidProductoQuery = 'SELECT id FROM clientes_cuentas WHERE did = ?';
      const results = await executeQuery(connection, checkDidProductoQuery, [this.did]);

      if (results.length > 0) {
        const updateQuery = 'UPDATE clientes_cuentas SET superado = 1 WHERE did = ?';
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
      const columnsQuery = 'DESCRIBE clientes_cuentas';
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO clientes_cuentas (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      
      const insertResult = await executeQuery(connection, insertQuery, values);
      
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE clientes_cuentas SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }



async delete(connection,did) {
    try {
        const deleteQuery = 'UPDATE clientes_cuentas SET elim = 1 WHERE did = ?';
        await executeQuery(connection, deleteQuery, [did]);
        return {
            estado: true,
            message: "Cliente cuenta eliminado correctamente."
        };
    }
    catch (error) {
        throw error;
    }
}
async getClientes(connection, did = null) {
  try {
    let query = 'SELECT * FROM clientes_cuentas WHERE elim = 0';
    const params = [];

    if (did) {
      query += ' AND didCliente = ?';
      params.push(did);
    }

    const results = await executeQuery(connection, query, params);

 
    return results;
  } catch (error) {
    console.error("Error en getClientes:", error.message);
    throw error;
  }
}







}

module.exports =  Cliente_cuentaV; 
