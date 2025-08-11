import { executeQuery } from "lightdata-tools";

class Atributo {
  constructor(
    did = "",
    nombre = "",
    descripcion = "",
    orden = 0,
    habilitado = 0,
    codigo = "",
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.nombre = nombre || "";
    this.descripcion = descripcion || "";
    this.orden = orden || 0;
    this.habilitado = habilitado;
    this.codigo = codigo || "";
    this.quien = quien || 0;
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
    const checkDidProductoQuery = "SELECT id FROM atributos WHERE did = ?";
    const results = await executeQuery(connection, checkDidProductoQuery, [
      this.did,
    ]);

    if (results.length > 0) {

      const updateQuery = "UPDATE atributos SET superado = 1 WHERE did = ?";
      await executeQuery(connection, updateQuery, [this.did]);
      return this.createNewRecord(connection);
    } else {
      return this.createNewRecord(connection);
    }
  }

  async createNewRecord(connection) {
    const querycheck =
      "SELECT codigo FROM atributos WHERE codigo = ? and superado = 0 and elim = 0";
    const resultscheck = await executeQuery(this.connection, querycheck, [
      this.codigo,
    ]);
    if (resultscheck.length > 0) {
      return {
        estado: false,
        message: "El codigo del atributo valor ya existe.",
      };
    }
    const columnsQuery = "DESCRIBE atributos";
    const results = await executeQuery(connection, columnsQuery, []);

    const tableColumns = results.map((column) => column.Field);
    const filteredColumns = tableColumns.filter(
      (column) => this[column] !== undefined
    );

    const values = filteredColumns.map((column) => this[column]);
    const insertQuery = `INSERT INTO atributos (${filteredColumns.join(
      ", "
    )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

    const insertResult = await executeQuery(connection, insertQuery, values);

    if (this.did == 0 || this.did == null) {
      const updateQuery = "UPDATE atributos SET did = ? WHERE id = ?";
      await executeQuery(connection, updateQuery, [
        insertResult.insertId,
        insertResult.insertId,
      ]);
    }

    return { insertId: insertResult.insertId };
  }

  async delete(connection, did) {
    const deleteQuery =
      "UPDATE atributos SET elim = 1 WHERE did = ? AND superado = 0";
    await executeQuery(connection, deleteQuery, [did]);
    const deleteQuery2 =
      "UPDATE atributos_valores SET elim = 1 WHERE didAtributo = ? and superado = 0";
    await executeQuery(connection, deleteQuery2, [did]);
    return {
      estado: true,
      message: "atributo eliminado correctamente.",
    };
  }

  async getAll(connection, did) {
    const selectQuery = `
      SELECT 
        a.id,
        a.did AS atributo_id,
        a.nombre,
        a.codigo AS atributo_codigo,
        a.descripcion,
        av.did AS valor_id,
        av.codigo AS valor_codigo,
        av.valor AS valor_nombre,
        a.habilitado
      FROM atributos a
      LEFT JOIN atributos_valores av ON av.didAtributo = a.did AND av.elim = 0 and av.superado = 0
      WHERE a.elim = 0 AND a.superado = 0 and a.did = ? 
      ORDER BY a.did DESC
    `;

    const results = await executeQuery(connection, selectQuery, [did]);

    const atributosMap = new Map();

    for (const row of results) {
      if (!atributosMap.has(row.atributo_id)) {
        atributosMap.set(row.atributo_id, {
          nombre: row.nombre,
          codigo: row.atributo_codigo,
          did: row.atributo_id,
          descripcion: row.descripcion,
          habilitado: row.habilitado,
          valores: [],
        });
      }

      if (row.valor_id) {
        atributosMap.get(row.atributo_id).valores.push({
          did: row.valor_id,
          codigo: row.valor_codigo,
          valor: row.valor_nombre,
        });
      }
    }

    return Array.from(atributosMap.values());
  }
  async getAtributos(connection, filtros) {
    const conditions = ["elim = 0", "superado = 0"];
    const values = [];

    if (filtros.habilitado != "") {
      conditions.push("habilitado = ?");
      values.push(filtros.habilitado);
    }

    if (filtros.codigo) {
      conditions.push("codigo LIKE ?");
      values.push(`%${filtros.codigo}%`);
    }

    if (filtros.nombre) {
      conditions.push("nombre LIKE ?");
      values.push(`%${filtros.nombre}%`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const pagina = Number(filtros.pagina) || 1;
    const cantidadPorPagina = Number(filtros.cantidad) || 10;
    const offset = (pagina - 1) * cantidadPorPagina;

    const totalQuery = `SELECT COUNT(*) as total FROM atributos ${whereClause}`;
    const totalResult = await executeQuery(
      connection,
      totalQuery,
      values,
      true
    );
    const totalRegistros = totalResult[0].total;
    const totalPaginas = Math.ceil(totalRegistros / cantidadPorPagina);

    const dataQuery = `
      SELECT id,did, nombre, codigo, descripcion, habilitado,autofecha,orden FROM atributos
      ${whereClause}
      ORDER BY did DESC
      LIMIT ? OFFSET ?
    `;
    const dataValues = [...values, cantidadPorPagina, offset];


    const results = await executeQuery(connection, dataQuery, dataValues);

    return {
      totalRegistros,
      totalPaginas,
      pagina,
      cantidad: cantidadPorPagina,
      atributos: results,
    };
  }

  async getAllFull(connection) {
    const selectQuery = `
      SELECT 
        a.id,
        a.did AS atributo_id,
        a.nombre,
        a.codigo AS atributo_codigo,
        a.descripcion,
        av.did AS valor_id,
        av.codigo AS valor_codigo,
        av.valor AS valor_nombre,
        a.habilitado
      FROM atributos a
      LEFT JOIN atributos_valores av ON av.didAtributo = a.did AND av.elim = 0 and av.superado = 0
      WHERE a.elim = 0 AND a.superado = 0
      ORDER BY a.did DESC
    `;

    const results = await executeQuery(connection, selectQuery, []);

    const atributosMap = new Map();

    for (const row of results) {
      if (!atributosMap.has(row.atributo_id)) {
        atributosMap.set(row.atributo_id, {
          tipo: row.nombre,
          codigo: row.atributo_codigo,
          did: row.atributo_id,
          obs: row.descripcion,

          habilitado: row.habilitado,
          valores: [],
        });
      }

      if (row.valor_id) {
        atributosMap.get(row.atributo_id).valores.push({
          codigo: row.valor_codigo,
          nombre: row.valor_nombre,
          did: row.valor_id,
        });
      }
    }

    return Array.from(atributosMap.values());
  }
}
export default Atributo;
