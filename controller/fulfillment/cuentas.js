const { getConnection, getFromRedis, executeQuery } = require('../../dbconfig');
const { logYellow, logBlue } = require('../../fuctions/logsCustom');


class Cuenta {
  constructor(
    did = 0,
    didProducto = "",
    didTienda = "",
    codigo = "",
    quien = 0,
    superado= 0,
    elim = "",
    connection = null,
   idEmpresa = null
   )
  
  
  {
    this.did = did ;
    this.didProducto = didProducto;
    this.didTienda = didTienda;
    this.codigo = codigo;
    this.quien = quien || 0;
    this.superado = superado;
    this.elim = elim;    
    this.connection = connection
    this.idEmpresa = String(idEmpresa);
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
        const checkDidEnvioQuery = 'SELECT id FROM fulfillment_cuentas WHERE did = ?';
        
        
        const results = await executeQuery(connection, checkDidEnvioQuery, [this.did]);
        console.log(results.length,"results");
        

        if (results.length > 0) {
           
            console.log("GOLA");
            
            const updateQuery = 'UPDATE fulfillment_cuentas SET superado = 1 WHERE did = ?';
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
        const columnsQuery = 'DESCRIBE fulfillment_cuentas';
        
        
        
        const results = await executeQuery(connection, columnsQuery, []);

        const tableColumns = results.map((column) => column.Field);
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

        const values = filteredColumns.map((column) => this[column]);
        const insertQuery = `INSERT INTO fulfillment_cuentas (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
       
        const insertResult = await executeQuery(connection, insertQuery, values);
        const insertId = insertResult.insertId;
        
        if(this.did == 0 || this.did == null){
            
            const updateQuery = 'UPDATE fulfillment_cuentas SET did = ? WHERE id = ?';
          await executeQuery(connection, updateQuery, [insertId, insertId]);
        }



        return { insertId: insertResult.insertId };
    } catch (error) {
        throw error;
    }
}



async eliminar (connection,did) {
    try {
        const deleteQuery = 'UPDATE fulfillment_cuentas set elim = 1 WHERE did = ?';
        await executeQuery(connection, deleteQuery, [did]);
    } catch (error) {
        throw error;
    }

}
}

module.exports = Cuenta;