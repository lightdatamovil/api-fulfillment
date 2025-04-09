const e = require('cors');
const { getConnection, executeQuery } = require('../../dbconfig');

class ProductO1 {
  constructor(
    did = "",
    didCliente = 0,
    sku = "",
    titulo = "",
    descripcion = "",
    imagen = "",
    habilitado = 0,
    esCombo = 0,
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.didCliente = didCliente;
    this.sku = sku;
    this.titulo = titulo;
    this.descripcion = descripcion;
    this.imagen = imagen;
    this.habilitado = habilitado;
    this.esCombo = esCombo;
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
      const checkDidProductoQuery = 'SELECT id FROM productos WHERE did = ?';
      const results = await executeQuery(connection, checkDidProductoQuery, [this.did]);

      if (results.length > 0) {
        const updateQuery = 'UPDATE productos SET superado = 1 WHERE did = ?';
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
      const columnsQuery = 'DESCRIBE productos';
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO productos (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
      
      const insertResult = await executeQuery(connection, insertQuery, values);
      
      if (this.did == 0 || this.did == null) {
        const updateQuery = 'UPDATE productos SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
      }
      
      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }
  async checkDelete(did,connection) {
    try {
        const checkDeleteQuery = 'SELECT did FROM productos_combos WHERE did = ? AND superado = 0 AND elim = 0';
        const results = await executeQuery(connection, checkDeleteQuery, [did]);
        console.log("results", results);

        return results.length > 0; 
    } catch (error) {
        throw error;
    }
}

async delete(connection,did) {
    try {
        const existsInCombo = await this.checkDelete(did,connection);
console.log(existsInCombo,"existsInCombo");

        if (existsInCombo == true) {
            console.log("llegamos");
            
            // Si existe en combos, devuelve un mensaje de advertencia
            return "Existe un combo con este producto "
        } else {
            // Si no existe en combos, procede a eliminar
            const deleteQuery = 'UPDATE productos SET elim = 1 WHERE did = ?';
            await executeQuery(connection, deleteQuery, [did]);
            return {
                estado: true,
                message: "Producto eliminado correctamente."
            };
        }
    } catch (error) {
        throw error;
    }
}
async forzarDelete(connection,did) {
    try {
        const deleteQuery = 'UPDATE productos SET elim = 1 WHERE did = ?';
        await executeQuery(connection, deleteQuery, [did]);
        return {
            estado: true,
            message: "Producto eliminado correctamente."
        };
    }
    catch (error) {
        throw error;
    }
}
async traerProducto( connection) {
    try {
        const query = 'SELECT * FROM productos';
        const results = await executeQuery(connection, query, []);
        return results;
    } catch (error) {
        console.error("Error al traer el producto:", error.message);
        throw {
            status: 500,
            response: {
                estado: false,
                error: -1,
            },
        };
    }
}


async traerProductoId(connection, id) {
  try {
  const query = `SELECT p.titulo,p.sku,p.didCLiente,p.habilitado,p.esCombo,p.imagen, 
  pe.url,pe.did,pe.flex,pe.habilitado as habilitadoEcommerce,pe.sync,
  pd.didDeposito,pd.habilitado as habilitadoDeposito,
  pc.did,pc.cantidad

  
  FROM productos as p 
  left join productos_combos as pc on pc.didProducto = p.did 
  left join productos_depositos as pd on pd.didProducto = p.did
  left join productos_ecommerces as pe on pe.didProducto = p.did 
  where p.did = ? and p.elim = 0 and p.superado = 0 `;


  
  const results = await executeQuery(connection, query, [id],true);

  
  return results;
  


}
catch (error) {
  console.error("Error al traer el producto:", error.message);
  throw {
      status: 500,
      response: {
          estado: false,
          error: -1,
      },
  };
}

}







}

module.exports =  ProductO1 ;
