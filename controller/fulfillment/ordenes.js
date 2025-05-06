const { getConnection, getFromRedis, executeQuery } = require("../../dbconfig");
const { logYellow, logBlue } = require("../../fuctions/logsCustom");

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
    fecha_venta = null,
    quien_armado = "",
    ml_shipment_id = null,
    ml_id = "",
    mi_packing_id = null,
    buyer_id = null,
    buyer_nickname = null,
    buyer_name = null,
    buyer_last_name = null,
    total_amount = null,
    seller_sku = null,

    connection = null
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
    this.fecha_venta = fecha_venta;
    this.quien_armado = quien_armado;
    this.ml_shipment_id = ml_shipment_id || "";
    this.ml_id = ml_id;
    this.mi_packing_id = mi_packing_id;
    this.buyer_id = buyer_id;
    this.buyer_nickname = buyer_nickname;
    this.buyer_name = buyer_name;
    this.buyer_last_name = buyer_last_name;
    this.total_amount = total_amount;
    this.seller_sku = seller_sku;

    this.connection = connection;
  }
  // Método para convertir a JSON
  toJSON() {
    return JSON.stringify(this);
  }

  // Método para insertar en la base de datos
  async insert() {
    try {
      // Si `didEnvio` no es null, verificar si ya existe y manejarlo
      return this.checkAndUpdateDidEnvio(this.connection);
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
      const checkDidEnvioQuery =
        "SELECT number,did FROM ordenes WHERE number = ? and didCliente = ? and didCuenta =? and flex = ? and superado = 0 and elim = 0";
      const results = await executeQuery(connection, checkDidEnvioQuery, [
        this.number,
        this.didCliente,
        this.didCuenta,
        this.flex,
      ]);

      this.did = results[0]?.did || 0;

      if (results.length > 0) {
        console.log("entramossss");
        return await this.updateRecord(connection);
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
      const columnsQuery = "DESCRIBE ordenes";
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter(
        (column) =>
          this[column] !== undefined &&
          !(column === "did" && (this[column] === 0 || this[column] === null))
      );

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO ordenes (${filteredColumns.join(
        ", "
      )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

      const insertResult = await executeQuery(connection, insertQuery, values);
      const insertId = insertResult.insertId;
      if (this.did == 0 || this.did == null) {
        const didquery = "select did from ordenes where number = ? ";
        const didresult = await executeQuery(connection, didquery, [
          this.number,
        ]);
        this.did = didresult[0].did;
        const updateQuery = "UPDATE ordenes SET did = ? WHERE id = ?";
        await executeQuery(connection, updateQuery, [insertId, insertId]);
      }

      // await this.insertHistorial(connection, insertId);

      return { insertId: insertId || this.did };
    } catch (error) {
      throw error;
    }
  }

  async updateRecord(connection) {
    try {
      const columnsQuery = "DESCRIBE ordenes";
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter(
        (column) =>
          this[column] !== undefined && column !== "id" && column !== "did"
      );

      const setClause = filteredColumns
        .map((column) => `${column} = ?`)
        .join(", ");
      const values = filteredColumns.map((column) => this[column]);

      const updateQuery = `UPDATE ordenes SET ${setClause} WHERE number = ?`;
      values.push(this.number); // 'number' va en el WHERE
      console.log(updateQuery, "updateQuery");

      const updateResult = await executeQuery(connection, updateQuery, values);
      console.log(updateResult, "updateResult");

      return { insertId: this.did }; // <-- ESTA ES LA LÍNEA CLAVE
    } catch (error) {
      console.error("Error en el método updateRecord:", error.message);
      throw error;
    }
  }

  async eliminar(connection, did) {
    try {
      const deleteQuery = "UPDATE ordenes set elim = 1 WHERE did = ?";
      await executeQuery(connection, deleteQuery, [did]);
      const deletetequery2 =
        "UPDATE ordenes_items set elim = 1 WHERE didOrden = ? and superado = 0";
      await executeQuery(connection, deletetequery2, [did]);
      const deletequery3 =
        "UPDATE ordenes_historial set elim = 1 WHERE didOrden = ? and superado = 0";
      await executeQuery(connection, deletequery3, [did]);
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
              o.id, o.did, o.didEnvio, o.didCliente, o.didCuenta, o.status, o.flex, 
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
          ) AS oi ON o.id = oi.didOrden
          WHERE o.id = ? AND o.elim = 0 AND o.superado = 0
      `;

      const results = await executeQuery(connection, query, [
        did,
        cantidad,
        offset,
        did,
      ]);

      if (results.length === 0) return null;

      const orden = {
        id: results[0].id,
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
        items: [],
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
            autofecha: row.item_autofecha,
          });
        }
      }

      return {
        orden,
        totalItems,
        totalPages,
        pagina,
        cantidad,
      };
    } catch (error) {
      console.error("Error en getOrdenPorId:", error.message);
      throw error; // Lanzar error para manejo superior
    }
  }
  async getTodasLasOrdenes(
    connection,
    pagina = 1,
    cantidad = 10,
    filtros = {}
  ) {
    try {
      pagina = parseInt(pagina);
      cantidad = parseInt(cantidad);
      if (isNaN(pagina) || pagina < 1) pagina = 1;
      if (isNaN(cantidad) || cantidad < 1) cantidad = 10;

      const offset = (pagina - 1) * cantidad;

      // Condiciones básicas
      let condiciones = [`elim = 0`, `superado = 0`];
      let valores = [];

      // Filtros aplicables
      if (filtros.ml_shipment_id) {
        condiciones.push(`ml_shipment_id = ?`);
        valores.push(filtros.ml_shipment_id);
      }

      if (filtros.ml_pack_id) {
        condiciones.push(`ml_pack_id = ?`);
        valores.push(filtros.ml_pack_id);
      }

      if (filtros.status) {
        condiciones.push(`status = ?`);
        valores.push(filtros.status);
      }

      if (filtros.flex) {
        condiciones.push(`flex = ?`);
        valores.push(filtros.flex);
      }

      if (filtros.number) {
        condiciones.push(`number = ?`);
        valores.push(filtros.number);
      }

      if (filtros.didCuenta) {
        condiciones.push(`didCuenta = ?`);
        valores.push(filtros.didCuenta);
      }

      if (filtros.fechaInicio && filtros.fechaFin) {
        condiciones.push(`fecha_venta BETWEEN ? AND ?`);
        valores.push(filtros.fechaInicio, filtros.fechaFin);
      }

      const whereClause = condiciones.length
        ? `WHERE ${condiciones.join(" AND ")}`
        : "";

      const query = `
      SELECT id, did, didEnvio, didCliente, didCuenta, status, flex, 
             number, fecha_venta, observaciones, armado, descargado, 
             fecha_armado, quien_armado, autofecha, ml_shipment_id, 
             ml_id, ml_pack_id, buyer_id, buyer_nickname, 
             buyer_name, buyer_last_name, total_amount
      FROM ordenes
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

      const results = await executeQuery(connection, query, [
        ...valores,
        cantidad,
        offset,
      ]);

      const countQuery = `
      SELECT COUNT(*) AS total 
      FROM ordenes
      ${whereClause}
    `;
      const countResult = await executeQuery(connection, countQuery, valores);
      const total = countResult[0]?.total || 0;
      const totalPages = Math.ceil(total / cantidad);

      return {
        ordenes: results,
        total,
        totalPages,
        pagina,
        cantidad,
      };
    } catch (error) {
      console.error("Error en getTodasLasOrdenes:", error.message);
      throw error;
    }
  }
  async delete(connection, did) {
    try {
      const deleteQuery = "UPDATE ordenes SET elim = 1 WHERE did = ?";
      await executeQuery(connection, deleteQuery, [did]);
      const deleteItemsQuery =
        "UPDATE ordenes_items SET elim = 1 WHERE didOrden = ? AND superado = 0";
      await executeQuery(connection, deleteItemsQuery, [did]);
      const deleteHistorialQuery =
        "UPDATE ordenes_historial SET elim = 1 WHERE didOrden = ? AND superado = 0 LIMIT 1";
      await executeQuery(connection, deleteHistorialQuery, [did]);

      return {
        estado: true,
        message: "Orden eliminada correctamente.",
      };
    } catch (error) {
      throw error;
    }
  }

  // Dentro de la clase Ordenes
  static async esEstadoRepetido(connection, number, nuevoEstado) {
    const query = "SELECT status FROM ordenes WHERE number = ?";
    const result = await executeQuery(connection, query, [number]);
    if (result.length === 0) return false; // No existe, por lo tanto no es repetido
    return result[0].status === nuevoEstado;
  }
}
module.exports = Ordenes;
