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

}}
module.exports = Ordenes;