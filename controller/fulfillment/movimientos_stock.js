const { getConnection, executeQuery } = require('../../dbconfig');
const { logYellow, logBlue } = require('../../fuctions/logsCustom');

class Movimientos_stock {
    constructor(
      did = "",
      didCliente = "",
      fecha = new Date(),
      didConcepto = "",
      didArmado = "",
      observaciones = "",
      lineas = "",
      total = "",
      quien = 0,
      superado = 0,
      elim = 0,
      connection = null,
    ) {
      this.did = did;
      this.didCliente = didCliente;
  
      // Verifica si fecha es un objeto Date, si no, lo convierte
      if (!(fecha instanceof Date)) {
        fecha = new Date(fecha);
      }
     
// Ajustar la fecha al formato correcto antes de asignarla
this.fecha = fecha.toISOString().slice(0, 19).replace("T", " ");

  
      this.didConcepto = didConcepto;
      this.didArmado = didArmado;
      this.observaciones = observaciones;
      this.lineas = lineas;
      this.total = total;
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
      if (this.did === null) {
        return this.createNewRecord(this.connection);
      } else {
        return this.checkAndUpdateDidMovimiento(this.connection);
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

  async checkAndUpdateDidMovimiento(connection) {
    try {
      const checkDidMovimientoQuery = 'SELECT id FROM fulfillment_movimientos_stock WHERE did = ?';
      const results = await executeQuery(connection, checkDidMovimientoQuery, [this.did]);

      if (results.length > 0) {
        const updateQuery = 'UPDATE fulfillment_movimientos_stock SET superado = 1 WHERE did = ?';
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
      const columnsQuery = 'DESCRIBE fulfillment_movimientos_stock';
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO fulfillment_movimientos_stock (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      
      const insertResult = await executeQuery(connection, insertQuery, values);
      
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE fulfillment_movimientos_stock SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }

  async eliminar(connection, did) {
    try {
      const deleteQuery = 'UPDATE fulfillment_movimientos_stock SET elim = 1 WHERE did = ?';
      await executeQuery(connection, deleteQuery, [did]);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Movimientos_stock;
