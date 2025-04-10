const { getConnection, executeQuery } = require('../../dbconfig');

class ProductoEcommerce {
  constructor(
    did = "",
    didProducto = 0,
    flex = 0,
    url = "",
    habilitado = 0,
    sync_automatico = 0,
    sku = "",
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.didProducto = didProducto;
    this.flex = flex;
    this.url = url;
    this.habilitado = habilitado;
    this.sync_automatico = sync_automatico;
    this.sku = sku;
    this.quien = quien || 0;
    this.superado = superado;
    this.elim = elim;
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
        return this.checkAndUpdateDidProductoEcommerce(this.connection);
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

  async checkAndUpdateDidProductoEcommerce(connection) {
    try {
      const checkDidProductoEcommerceQuery = 'SELECT id,did,url, sku,habilitado,flex FROM productos_ecommerces WHERE flex = ? AND didProducto = ? AND elim = 0 AND superado = 0';
      const results = await executeQuery(connection, checkDidProductoEcommerceQuery, [this.flex,this.didProducto],true);
if( results[0].url != this.url || results[0].habilitado != this.habilitado || results[0].sku != this.sku){
  
console.log(results,"results[0].url != this.url || results[0].habilitado != this.habilitado || results[0].sku != this.sku");

  if (results.length > 0) {
    const updateQuery = 'UPDATE productos_ecommerces SET superado = 1 WHERE did = ?';
    await executeQuery(connection, updateQuery, [results[0].did]);
    return this.createNewRecord2(connection,results[0].did); ;
  } else {
    return this.createNewRecord(connection);
  }
}
    } catch (error) {
      throw error;
    }
  }

  async createNewRecord(connection) {
    try {
      const columnsQuery = 'DESCRIBE productos_ecommerces';
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO productos_ecommerces (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      
      const insertResult = await executeQuery(connection, insertQuery, values);
      
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE productos_ecommerces SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }
  async createNewRecord2(connection,did) {
    try {
      const columnsQuery = 'DESCRIBE productos_ecommerces';
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO productos_ecommerces (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      
      const insertResult = await executeQuery(connection, insertQuery, values);
      
      console.log("aloha",insertResult.insertId,did);
      
        const updateQuery = 'UPDATE productos_ecommerces SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [did, insertResult.insertId]);
   
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }

  async delete() {
    try {
      const deleteQuery = 'UPDATE productos_ecommerces SET elim = 1 WHERE did = ?';
      await executeQuery(this.connection, deleteQuery, [this.did]);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ProductoEcommerce;
