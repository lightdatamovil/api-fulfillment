const { getConnection, getFromRedis, executeQuery } = require('../../dbconfig');
const { logYellow, logBlue } = require('../../fuctions/logsCustom');


class Ordenes {
    constructor(
        did = "",
        didEnvio = "",
        didCliente = "",
        didCuenta = "",
        status = "",
        flex = 0,
        number = "",
        observaciones = "",
        armado = 0,
        descargado = 0,
        fecha_armado = null,
        quien_armado = "",
     
        connection = null,
    ) {
        this.did = did;
        this.didEnvio = didEnvio;
        this.didCliente = didCliente;
        this.didCuenta = didCuenta;
        this.status = status;
        this.flex = flex;
        this.number = number;
        this.observaciones = observaciones;
        this.armado = armado;
        this.descargado = descargado;
        this.fecha_armado = fecha_armado;
        this.quien_armado = quien_armado;
     
        this.connection = connection;
      }
  // Método para convertir a JSON
  toJSON() {
    return JSON.stringify(this);
  }

  // Método para insertar en la base de datos
  async insert() {
    try {
        if (this.did === null || this.did== 0 || this.did === "") {
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
        const checkDidEnvioQuery = 'SELECT id FROM ordenes WHERE did = ?';
        const results = await executeQuery(connection, checkDidEnvioQuery, [this.did]);

        if (results.length > 0) {
            // Si `didEnvio` ya existe, actualizarlo
            const updateQuery = 'UPDATE ordenes SET superado = 1 WHERE did = ?';
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
        const columnsQuery = 'DESCRIBE ordenes';
        const results = await executeQuery(connection, columnsQuery, []);

        const tableColumns = results.map((column) => column.Field);
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

        const values = filteredColumns.map((column) => this[column]);
        const insertQuery = `INSERT INTO ordenes (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;


        const insertResult = await executeQuery(connection, insertQuery, values);
        const insertId = insertResult.insertId;
        if(this.did == 0 || this.did == null){
            
            const updateQuery = 'UPDATE ordenes SET did = ? WHERE id = ?';
          await executeQuery(connection, updateQuery, [insertId, insertId]);
        }

        return { insertId: insertId };
    } catch (error) {
        throw error;
    }
}
async eliminar (connection,did) {
    try {
        const deleteQuery = 'UPDATE ordenes set elim = 1 WHERE did = ?';
        await executeQuery(connection, deleteQuery, [did]);
    } catch (error) {
        throw error;
    }

}

async getOrdenPorId(connection, did, pagina = 1, cantidad = 10) {
    try {
      const offset = (pagina - 1) * cantidad;
  
      // 1. Consultar total de ítems
      const countQuery = `
        SELECT COUNT(*) AS totalItems 
        FROM ordenes_items 
        WHERE didOrden = ? AND elim = 0 AND superado = 0
      `;
      const countResult = await executeQuery(connection, countQuery, [did]);
      const totalItems = countResult[0]?.totalItems ?? 0;
      const totalPages = Math.ceil(totalItems / cantidad);
  
      // 2. Consultar datos de la orden con ítems paginados
      const query = `
        SELECT 
          o.did, o.didEnvio, o.didCliente, o.didCuenta, o.status, o.flex, 
          o.number, o.fecha_venta, o.observaciones, o.armado, o.descargado, 
          o.fecha_armado, o.quien_armado, o.autofecha AS orden_autofecha,
  
          oi.codigo, oi.imagen, oi.descripcion, oi.ml_id, oi.dimensions, 
          oi.cantidad, oi.variacion, oi.seller_sku, 
          oi.descargado AS item_descargado, 
          oi.autofecha AS item_autofecha
  
        FROM ordenes o
        LEFT JOIN (
          SELECT * FROM ordenes_items 
          WHERE elim = 0 AND superado = 0 
          AND didOrden = ?
          LIMIT ? OFFSET ?
        ) AS oi ON o.did = oi.didOrden
  
        WHERE o.did = ? AND o.elim = 0 AND o.superado = 0
      `;
  
      const results = await executeQuery(connection, query, [did, cantidad, offset, did]);
  
      if (results.length === 0) return null;
  
      const orden = {
        did: results[0].did,
        didEnvio: results[0].didEnvio,
        didCliente: results[0].didCliente,
        didCuenta: results[0].didCuenta,
        status: results[0].status,
        flex: results[0].flex,
        number: results[0].number,
        fecha_venta: results[0].fecha_venta,
        observaciones: results[0].observaciones,
        armado: results[0].armado,
        descargado: results[0].descargado,
        fecha_armado: results[0].fecha_armado,
        quien_armado: results[0].quien_armado,
        autofecha: results[0].orden_autofecha,
        items: []
      };
  
      for (const row of results) {
        if (row.codigo) {
          orden.items.push({
            codigo: row.codigo,
            imagen: row.imagen,
            descripcion: row.descripcion,
            ml_id: row.ml_id,
            dimensions: row.dimensions,
            cantidad: row.cantidad,
            variacion: row.variacion,
            seller_sku: row.seller_sku,
            descargado: row.item_descargado,
            autofecha: row.item_autofecha
          });
        }
      }
  
      return {
        orden,
        totalItems,
        totalPages,
        pagina,
        cantidad
      };
    } catch (error) {
      throw error;
    }
  }
  
}
module.exports = Ordenes;