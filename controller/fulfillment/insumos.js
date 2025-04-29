const { getConnection, getFromRedis, executeQuery } = require('../../dbconfig');
const { logYellow, logBlue } = require('../../fuctions/logsCustom');


class Insumo {
  constructor(
    did = 0,
    didCliente = "",
    sku = "",
    descripcion = "",   
    quien = 0,
     superado= 0,
    elim = "",
    connection = null,

  )
  
  
  {
    this.did = did;
    this.didCliente = didCliente;
    this.sku = sku;
    this.descripcion = descripcion;
    this.superado = superado;
    this.elim = elim;    
    this.quien = quien || 0;
    this.connection = connection
  
  }

  // Método para convertir a JSON
  toJSON() {
    return JSON.stringify(this);
  }

  // Método para insertar en la base de datos
  async insert() {
    try {
    
        if (this.did === null) {
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
        const checkDidEnvioQuery = 'SELECT id FROM  fulfillment_insumos WHERE did = ?';
        
        
        const results = await executeQuery(connection, checkDidEnvioQuery, [this.did]);
        console.log(results.length,"results");
        

        if (results.length > 0) {
           
           // console.log("GOLA");
            
            const updateQuery = 'UPDATE  fulfillment_insumos SET superado = 1 WHERE did = ?';
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
        const columnsQuery = 'DESCRIBE  fulfillment_insumos';
        
        
        
        const results = await executeQuery(connection, columnsQuery, []);

        const tableColumns = results.map((column) => column.Field);
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

        const values = filteredColumns.map((column) => this[column]);
        const insertQuery = `INSERT INTO  fulfillment_insumos (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
       
        const insertResult = await executeQuery(connection, insertQuery, values);
        const insertId = insertResult.insertId;
        
        if(this.did == 0 || this.did == null){
            
            const updateQuery = 'UPDATE  fulfillment_insumos SET did = ? WHERE id = ?';
          await executeQuery(connection, updateQuery, [insertId, insertId]);
        }



        return { insertId: insertResult.insertId };
    } catch (error) {
        throw error;
    }
}



async eliminar (connection,did) {
    try {
        const deleteQuery = 'UPDATE fulfillment_insumos set elim = 1 WHERE did = ?';
        await executeQuery(connection, deleteQuery, [did]);
    } catch (error) {
        throw error;
    }

}

async getAll(connection, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
  
      // Consulta principal con paginado
      const selectQuery = `
        SELECT * FROM fulfillment_insumos 
        WHERE elim = 0 AND superado = 0 
        LIMIT ? OFFSET ?
      `;
      const results = await executeQuery(connection, selectQuery, [limit, offset]);
  
      // Conteo total para paginación
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
    } catch (error) {
      throw error;
    }
  }
  
}
module.exports = Insumo;