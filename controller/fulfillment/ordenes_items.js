const { getConnection, getFromRedis, executeQuery } = require('../../dbconfig');
const { logYellow, logBlue } = require('../../fuctions/logsCustom');


class Ordenes_items {
    constructor(
        did = "",
        didOrden = "",
        codigo = "",
        imagen = "",
        descripcion = "",
      ml_id = "",
      dimensions = "",
      cantidad = 0,
      variacion = "",
      seller_sku = "",
      descargado = 0,
      superado = 0,
      elim = 0,
        
        connection = null,
      ) {
        this.did = did;
        this.didOrden = didOrden;
        this.codigo = codigo;
        this.imagen = imagen;
        this.descripcion = descripcion;
        this.ml_id = ml_id;
        this.dimensions = dimensions;
        this.cantidad = cantidad;
        this.variacion = variacion;
        this.seller_sku = seller_sku;
        this.descargado = descargado;
        this.superado = superado || 0;
        this.elim = elim || 0;

        this.connection = connection;}
  // Método para convertir a JSON
  toJSON() {
    return JSON.stringify(this);
  }

  // Método para insertar en la base de datos
  async insert() {
    try {
        if (this.did === null || this.did === 0) {
            // Si `didEnvio` es null, crear un nuevo registro
            return this.createNewRecord(this.connection);
        } else {
            // Si `didEnvio` no es null, verificar si ya existe y manejarlo
            return this.checkAndUpdateDidEnvio(this.connection);
        }
    } catch (error) {
        console.error("Error en el método insert:", error.message);

        // Lanzar un error con el formato estándar
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
        const checkDidEnvioQuery = 'SELECT id FROM ordenes_items WHERE didOrden = ?';
        const results = await executeQuery(connection, checkDidEnvioQuery, [this.did]);

        if (results.length > 0) {
            // Si `didEnvio` ya existe, actualizarlo
            const updateQuery = 'UPDATE ordenes_items SET superado = 1 WHERE didOrden = ?';
            await executeQuery(connection, updateQuery, [this.did]);

            // Crear un nuevo registro con el mismo `didEnvio`
            return this.createNewRecord(connection);
        } else {
            // Si `didEnvio` no existe, crear un nuevo registro directamente
            return this.createNewRecord(connection);
        }
    } catch (error) {
        throw error;
    }
}

async createNewRecord(connection) {
    try {
        const columnsQuery = 'DESCRIBE ordenes_items';
        const results = await executeQuery(connection, columnsQuery, []);

        const tableColumns = results.map((column) => column.Field);
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

        const values = filteredColumns.map((column) => this[column]);
        const insertQuery = `INSERT INTO ordenes_items (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
        const insertResult = await executeQuery(connection, insertQuery, values);
    
      const insertId = insertResult.insertId;
    
        return { insertId: insertId };
    } catch (error) {
        throw error;
    }
}}
module.exports = Ordenes_items;