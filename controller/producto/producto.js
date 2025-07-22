
const { executeQuery } = require("../../dbconfig");
class ProductO1 {
  constructor(
    did = "",
    didCliente = 0,
    sku = "",
    titulo = "",
    ean = "",
    descripcion = "",
    imagen = "",
    habilitado = 0,
    esCombo = 0,
    posicion = "",
    cm3 = 0,
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.didCliente = didCliente;
    this.sku = sku;
    this.ean = ean;
    this.titulo = titulo;
    this.descripcion = descripcion;
    this.imagen = imagen;
    this.habilitado = habilitado;
    this.esCombo = esCombo;
    this.posicion = posicion;
    this.cm3 = cm3;
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
      if (this.did === null || this.did === "" || this.did === 0) {
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
      const checkDidProductoQuery = "SELECT id FROM productos WHERE did = ?";
      const results = await executeQuery(connection, checkDidProductoQuery, [
        this.did,
      ]);

      if (results.length > 0) {
        const updateQuery = "UPDATE productos SET superado = 1 WHERE did = ?";
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
      const querycheck =
        "SELECT sku FROM productos WHERE sku = ? and superado = 0 and elim = 0";
      const resultscheck = await executeQuery(
        connection,
        querycheck,
        [this.sku],
        true
      );
      console.log(resultscheck, "resultscheck");

      if (resultscheck.length > 0) {
        return {
          estado: false,
          message: "El Producto con ese sku ya existe.",
        };
      }
      const columnsQuery = "DESCRIBE productos";
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter(
        (column) => this[column] !== undefined
      );

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO productos (${filteredColumns.join(
        ", "
      )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

      const insertResult = await executeQuery(connection, insertQuery, values);

      if (this.did == 0 || this.did == null) {
        const updateQuery = "UPDATE productos SET did = ? WHERE id = ?";
        await executeQuery(connection, updateQuery, [
          insertResult.insertId,
          insertResult.insertId,
        ]);
      }

      return { insertId: insertResult.insertId };
    } catch (error) {
      throw error;
    }
  }
  async checkDelete(did, connection) {
    try {
      const checkDeleteQuery =
        "SELECT did FROM productos_combos WHERE did = ? AND superado = 0 AND elim = 0";
      const results = await executeQuery(connection, checkDeleteQuery, [did]);

      return results.length > 0;
    } catch (error) {
      throw error;
    }
  }

  async delete(connection, did) {
    try {
      const existsInCombo = await this.checkDelete(did, connection);
      console.log(existsInCombo, "existsInCombo");

      if (existsInCombo == true) {
        console.log("llegamos");

        // Si existe en combos, devuelve un mensaje de advertencia
        return "Existe un combo con este producto ";
      } else {
        // Si no existe en combos, procede a eliminar
        const deleteQuery = "UPDATE productos SET elim = 1 WHERE did = ?";
        await executeQuery(connection, deleteQuery, [did]);
        return {
          estado: true,
          message: "Producto eliminado correctamente.",
        };
      }
    } catch (error) {
      throw error;
    }
  }
  async forzarDelete(connection, did) {
    try {
      const deleteQuery = "UPDATE productos SET elim = 1 WHERE did = ?";
      await executeQuery(connection, deleteQuery, [did]);
      return {
        estado: true,
        message: "Producto eliminado correctamente.",
      };
    } catch (error) {
      throw error;
    }
  }
  async traerProductos(connection, data = {}) {
    try {
      let condiciones = ["p.elim = 0", "p.superado = 0"];
      let valores = [];

      if (data.habilitado !== undefined && data.habilitado !== "") {
        condiciones.push("p.habilitado = ?");
        valores.push(data.habilitado);
      }

      if (data.esCombo !== undefined && data.esCombo !== "") {
        condiciones.push("p.esCombo = ?");
        valores.push(data.esCombo);
      }

      if (data.cliente !== undefined && data.cliente !== "") {

        condiciones.push("p.didCliente = ?");
        valores.push(data.cliente);


      }

      if (data.sku !== undefined && data.sku.trim() !== "") {
        condiciones.push("p.sku LIKE ?");
        valores.push(`%${data.sku}%`);
      }

      if (data.titulo !== undefined && data.titulo.trim() !== "") {
        condiciones.push("p.titulo LIKE ?");
        valores.push(`%${data.titulo}%`);
      }

      if (data.ean !== undefined && data.ean.trim() !== "") {
        condiciones.push("p.ean LIKE ?");
        valores.push(`%${data.ean}%`);
      }

      const whereClause =
        condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

      const pagina = Number(data.pagina) || 1;
      const cantidad = Number(data.cantidad) || 10;
      const offset = (pagina - 1) * cantidad;

      // Consulta para total de registros
      const totalQuery = `
      SELECT COUNT(*) AS total
      FROM productos AS p
      ${whereClause}
      `;
      const totalResult = await executeQuery(connection, totalQuery, valores);
      const totalRegistros = totalResult[0]?.total || 0;
      const totalPaginas = Math.ceil(totalRegistros / cantidad);

      // Consulta principal con paginado
      const query = `
      SELECT p.did AS did, p.didCliente, p.sku, p.titulo, p.ean, p.habilitado, p.esCombo,p.cm3
      FROM productos AS p
      ${whereClause}
      ORDER BY p.did DESC
      LIMIT ? OFFSET ?
      `;

      const results = await executeQuery(connection, query, [
        ...valores,
        cantidad,
        offset,
      ], true);

      return {
        data: results,
        totalRegistros,
        totalPaginas,
        pagina,
        cantidad,
      };
    } catch (error) {
      console.error("Error al traer productos:", error.message);
      throw {
        estado: false,
        error: -1,
        message: error.message || error,
      };
    }
  }

  async traerProductoId(connection, id) {
    try {
      const query = `
        SELECT 
          p.did,
          p.didCliente AS cliente,
          p.titulo,
          p.sku,
          p.ean,
          p.descripcion,
          p.habilitado,
          p.cm3,
          p.esCombo,
          p.imagen,
  
          pv.did as didVariante,
          pv.data AS dataVariante,
  
          pc.did AS didCombo,
          pc.cantidad AS cantidadCombo,
          pc.didProductoCombo,
  
          pi.did AS didInsumo,
          pi.cantidad AS cantidadInsumo,
  
          pe.did AS didEcommerce,
          pe.url AS urlEcommerce,
          pe.flex AS flexEcommerce,
          pe.actualizar AS actualizarEcommerce,
          pe.sku AS skuEcommerce,
          pe.ean AS eanEcommerce,

          pe.variante AS varianteEcommerce


  
        FROM productos AS p
        LEFT JOIN productos_combos AS pc 
          ON pc.didProducto = p.did AND pc.elim = 0 AND pc.superado = 0
        LEFT JOIN productos_variantes AS pv 
          ON pv.didProducto = p.did AND pv.elim = 0 AND pv.superado = 0
        LEFT JOIN productos_insumos AS pi 
          ON pi.didProducto = p.did AND pi.elim = 0 AND pi.superado = 0
        LEFT JOIN productos_ecommerces AS pe 
          ON pe.didProducto = p.did AND pe.elim = 0 AND pe.superado = 0
        WHERE p.did = ? AND p.elim = 0 AND p.superado = 0
      `;

      const rows = await executeQuery(connection, query, [id], true);
      if (!rows.length) return null;

      const producto = {
        did: rows[0].did,
        cliente: rows[0].cliente,
        titulo: rows[0].titulo,
        sku: rows[0].sku,
        descripcion: rows[0].descripcion,
        habilitado: rows[0].habilitado,
        esCombo: rows[0].esCombo,
        imagen: rows[0].imagen || "",
        cm3: rows[0].cm3 || 0,
        variantes: [],
        insumos: [],
        combos: [],
        ecommerce: [],
      };

      const setVariante = new Set();
      const setInsumo = new Set();
      const setCombo = new Set();
      const setEcommerce = new Set();

      for (const row of rows) {
        // Variantes
        if (row.didVariante && !setVariante.has(row.didVariante)) {
          setVariante.add(row.didVariante);
          producto.variantes.push({
            did: row.didVariante,
            data: row.dataVariante ? JSON.parse(row.dataVariante) : null,
          });
        }

        // Insumos
        if (row.didInsumo && !setInsumo.has(row.didInsumo)) {
          setInsumo.add(row.didInsumo);
          producto.insumos.push({
            did: row.didInsumo,
            cantidad: row.cantidadInsumo,
          });
        }

        // Combos
        if (row.didCombo && !setCombo.has(row.didCombo)) {
          setCombo.add(row.didCombo);
          producto.combos.push({
            did: row.didCombo,
            cantidad: row.cantidadCombo,
            didProductoCombo: row.didProductoCombo,
          });
        }

        // Ecommerce
        if (row.didEcommerce && !setEcommerce.has(row.didEcommerce)) {
          setEcommerce.add(row.didEcommerce);
          producto.ecommerce.push({
            did: row.didEcommerce,
            variante: row.varianteEcommerce
              ? JSON.parse(row.varianteEcommerce)
              : null,
            url: row.urlEcommerce,
            flex: row.flexEcommerce,
            actualizar: row.actualizarEcommerce,
            sku: row.skuEcommerce,
            ean: row.eanEcommerce,
          });
        }
      }
      console.log(producto, "producto");

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
  async traerProductosAll(connection) {
    try {
      const query = `
        SELECT p.did AS did, p.didCliente, p.sku, p.titulo, p.ean, p.habilitado, p.esCombo, p.cm3
        FROM productos AS p
        WHERE p.elim = 0 AND p.superado = 0
        ORDER BY p.did DESC
      `;

      const results = await executeQuery(connection, query);

      return results;
    } catch (error) {
      console.error("Error al traer productos:", error.message);
      throw {
        estado: false,
        error: -1,
        message: error.message || error,
      };
    }
  }

  async filtro(connection, data) {
    try {
      let condiciones = ["p.elim = 0", "p.superado = 0"];
      let valores = [];
      let joins = "";

      if (data.flex !== undefined) {
        joins += "INNER JOIN productos_ecommerces pe ON pe.didProducto = p.did";
        condiciones.push("pe.flex = ?");
        valores.push(data.flex);
      }

      if (data.habilitado !== undefined) {
        condiciones.push("p.habilitado = ?");
        valores.push(data.habilitado);
      }

      if (data.esCombo !== undefined) {
        condiciones.push("p.esCombo = ?");
        valores.push(data.esCombo);
      }

      if (data.cliente !== undefined) {
        condiciones.push("p.didCliente = ?");
        valores.push(data.cliente);
      }

      if (data.sku !== undefined && data.sku.trim() !== "") {
        condiciones.push("p.sku LIKE ?");
        valores.push(`%${data.sku}%`);
      }

      const whereClause =
        condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
      const filtroQuery = `
      SELECT p.* 
      FROM productos AS p 
      ${joins}
      ${whereClause}
    `;

      const results = await executeQuery(connection, filtroQuery, valores);

      return results;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ProductO1;
