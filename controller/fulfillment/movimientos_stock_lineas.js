const { getConnection, getFromRedis, executeQuery } = require('../../dbconfig');
const { logYellow, logBlue } = require('../../fuctions/logsCustom');

class MovimientosStockLineas {
  constructor(
    did = "",
    didMovimiento = "",
    didProducto = "",
    didDeposito = "",   
    tipo = "",
    cantidad = "",
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null,
  ) {
    this.did = did;
    this.didMovimiento = didMovimiento;
    this.didProducto = didProducto;
    this.didDeposito = didDeposito;
    this.tipo = tipo;
    this.cantidad = cantidad;
    this.superado = superado;
    this.elim = elim;    
    this.quien = quien || 0;
    this.connection = connection;
  }

  // Método para convertir a JSON
  toJSON() {
    return JSON.stringify(this);
  }

  // Método para insertar en la base de datos
  async insert() {
    try {
      if (this.didProducto === null) {
        return this.createNewRecord(this.connection);
      } else {
        return this.checkAndUpdateDidEnvio(this.connection);
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

  async checkAndUpdateDidEnvio(connection) {
    try {
      
        
      const checkDidEnvioQuery = 'SELECT id FROM fulfillment_movimientos_stock_lineas WHERE did = ?';
      const results = await executeQuery(connection, checkDidEnvioQuery, [this.did]);
      
      if (results.length > 0) {

        const updateQuery = 'UPDATE fulfillment_movimientos_stock_lineas SET superado = 1 WHERE did = ?';
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

      const columnsQuery = 'DESCRIBE fulfillment_movimientos_stock_lineas';
      const results = await executeQuery(connection, columnsQuery, []);
   
      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);
      
      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO fulfillment_movimientos_stock_lineas (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      const insertResult = await executeQuery(connection, insertQuery, values);
   
      const insertId = insertResult.insertId;
      
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE fulfillment_movimientos_stock_lineas SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertId, insertId]);
      }
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }

  async eliminar(connection, did) {
    try {
      const deleteQuery = 'UPDATE fulfillment_movimientos_stock_lineas SET elim = 1 WHERE did = ?';
      await executeQuery(connection, deleteQuery, [did]);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = MovimientosStockLineas;
