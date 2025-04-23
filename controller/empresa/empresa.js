const crypto = require('crypto');
const { getConnection, executeQuery } = require('../../dbconfig');
const { log } = require('console');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex'); // Generar un salt aleatorio
  const hashedPassword = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
  return `$5$${salt}$${hashedPassword}`;
}

class Empresa {
  constructor(
    did = "",
    nombre = "",
    codigo = "",
    tipo = 1,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.nombre = nombre;
    this.codigo = codigo;
    this.tipo = tipo;
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
      const checkDidProductoQuery = 'SELECT id FROM sistema_empresa WHERE did = ?';
      const results = await executeQuery(connection, checkDidProductoQuery, [this.did]);

      if (results.length > 0) {
        const updateQuery = 'UPDATE sistema_empresa SET superado = 1 WHERE did = ?';
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
      const columnsQuery = 'DESCRIBE sistema_empresa';
      const results = await executeQuery(connection, columnsQuery, []);
  
      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);
  
      // 🧂 Hasheamos la contraseña si está presente y no está ya en formato $5$
      if (this.pass && !this.pass.startsWith('$5$')) {
        this.pass = hashPassword(this.pass); // Usamos hashPassword aquí
      }
  
      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO sistema_empresa (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
  
      const insertResult = await executeQuery(connection, insertQuery, values);
  
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE sistema_empresa SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
  
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }

  async delete(connection, did) {
    try {
      const deleteQuery = 'UPDATE sistema_empresa SET elim = 1 WHERE did = ?';
      await executeQuery(connection, deleteQuery, [did]);
      return {
        estado: true,
        message: "Producto eliminado correctamente."
      };
    } catch (error) {
      throw error;
    }
  }

  
}

module.exports = Empresa;
