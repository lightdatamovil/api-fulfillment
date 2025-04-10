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
        const query = 'SELECT didCliente,sku,titulo,habilitado,did FROM productos';
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


async  traerProductoId(connection, id) {
  try {
    const query = `
      SELECT 
        p.did,
        p.didCliente AS cliente,
  
        p.titulo,
        p.sku,
        p.descripcion,
        p.habilitado,
        p.esCombo,
        p.imagen,

        pe.flex,
        pe.url AS link,
        pe.sku AS skuEcommerce,
 
        pe.habilitado AS habilitadoEcommerce,
        pe.sync,

        pc.did AS comboDid,
        pc.cantidad,

        pd.didDeposito,
        pd.habilitado AS habilitadoDeposito

      FROM productos AS p
      LEFT JOIN productos_combos AS pc ON pc.didProducto = p.did 
      LEFT JOIN productos_depositos AS pd ON pd.didProducto = p.did
      LEFT JOIN productos_ecommerces AS pe ON pe.didProducto = p.did 
      WHERE p.did = ? AND p.elim = 0 AND p.superado = 0
    `;

    const rows = await executeQuery(connection, query, [id], true);

    if (!rows.length) return null;

    const producto = {
      did: rows[0].did,
      cliente: rows[0].cliente,
      idEmpresa: rows[0].idEmpresa,
      titulo: rows[0].titulo,
      sku: rows[0].sku,
      descripcion: rows[0].descripcion,
      habilitado: rows[0].habilitado,
      esCombo: rows[0].esCombo,
      imagen: rows[0].imagen || "",
      ecommerce: [],
      combo: [],
      depositos: [],
    };

    const ecommerceMap = new Set();
    const comboMap = new Set();
    const depositoMap = new Set();

    for (const row of rows) {
      // ECOMMERCE
      if (row.flex && !ecommerceMap.has(row.flex + row.link)) {
        producto.ecommerce.push({
          tienda: row.flex,
          link: row.link,
          sku: row.sku_ecommerce,
          habilitado: row.habilitadoEcommerce,
          sku: row.skuEcommerce,
          sync: row.sync
        });
        ecommerceMap.add(row.flex + row.link);
      }

      // COMBO
      if (row.comboDid && !comboMap.has(row.comboDid) &&row.esCombo == 1) {
        producto.combo.push({
          did: row.comboDid,
          cantidad: row.cantidad
        });
        comboMap.add(row.comboDid);
      }

      // DEPOSITOS
      if (row.didDeposito && !depositoMap.has(row.didDeposito)) {
        producto.depositos.push({
          did: row.didDeposito,
          habilitado: row.habilitadoDeposito
        });
        depositoMap.add(row.didDeposito);
      }
    }

    return producto;

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








}

module.exports =  ProductO1 ;
