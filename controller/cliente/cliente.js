const { getConnection, executeQuery } = require("../../dbconfig");
const { logYellow } = require("../../fuctions/logsCustom");
function encodeArr(data) {
  const json = JSON.stringify(data); // Serializa el objeto
  const base64 = Buffer.from(json).toString('base64'); // Lo codifica en base64
  return base64;
}
function generateToken4() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
  let token = "";

  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    token += chars.charAt(randomIndex);
  }

  return token;
}

class Cliente {
  constructor(
    did = "",
    nombre_fantasia = "",
    habilitado = 1,
    codigo = "",
    razon_social = "",
    observaciones = "",
    quien = 0,
    superado = 0,
    elim = 0,
    connection = null
  ) {
    this.did = did;
    this.nombre_fantasia = nombre_fantasia;
    this.habilitado = habilitado;
    this.codigo = codigo || "";
    this.razon_social = razon_social || "";
    this.observaciones = observaciones || "";
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
      const checkDidProductoQuery = "SELECT id FROM clientes WHERE did = ?";
      const results = await executeQuery(connection, checkDidProductoQuery, [
        this.did,
      ]);

      if (results.length > 0) {
        const updateQuery = "UPDATE clientes SET superado = 1 WHERE did = ?";
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
        "SELECT nombre_fantasia FROM clientes WHERE nombre_fantasia = ? and superado = 0 and elim = 0";
      const resultscheck = await executeQuery(this.connection, querycheck, [
        this.nombre_fantasia,
      ]);
      if (resultscheck.length > 0) {
        return {
          estado: false,
          message: "El cliente ya existe.",
        };
      }
      const columnsQuery = "DESCRIBE clientes";
      const results = await executeQuery(connection, columnsQuery, []);

      const tableColumns = results.map((column) => column.Field);
      const filteredColumns = tableColumns.filter(
        (column) => this[column] !== undefined
      );

      const values = filteredColumns.map((column) => this[column]);
      const insertQuery = `INSERT INTO clientes (${filteredColumns.join(
        ", "
      )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

      const insertResult = await executeQuery(connection, insertQuery, values);

      if (this.did == 0 || this.did == null) {
        const updateQuery = "UPDATE clientes SET did = ? WHERE id = ?";
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

  async delete(connection, did) {
    try {
      const deleteQuery = "UPDATE clientes SET elim = 1 WHERE did = ?";
      await executeQuery(connection, deleteQuery, [did]);
      return {
        estado: true,
        message: "Producto eliminado correctamente.",
      };
    } catch (error) {
      throw error;
    }
  }
  async getClientes(connection, filtros) {
    try {
      const conditions = ["c.superado = 0 and c.elim = 0"];
      const values = [];

      if (filtros.habilitado !== undefined && filtros.habilitado !== 2) {
        conditions.push("c.habilitado = ?");
        values.push(filtros.habilitado);
      }

      if (filtros.nombre_fantasia) {
        conditions.push("c.nombre_fantasia LIKE ?");
        values.push(`%${filtros.nombre_fantasia}%`);
      }

      if (filtros.codigo) {
        conditions.push("c.codigo LIKE ?");
        values.push(`%${filtros.codigo}%`);
      }

      if (filtros.razon_social) {
        conditions.push("c.razon_social LIKE ?");
        values.push(`%${filtros.razon_social}%`);
      }


      const whereClause = conditions.length
        ? ` WHERE ${conditions.join(" AND ")}`
        : "";

      const pagina = Number(filtros.pagina) || 1;
      const cantidadPorPagina = Number(filtros.cantidad) || 10;
      const offset = (pagina - 1) * cantidadPorPagina;

      const totalQuery = `SELECT COUNT(*) as total FROM clientes ${whereClause.replace(
        /c\./g,
        ""
      )}`;

      const totalResult = await executeQuery(connection, totalQuery, values);
      const totalRegistros = totalResult[0].total;
      const totalPaginas = Math.ceil(totalRegistros / cantidadPorPagina);

      // Trae los datos de clientes + sus direcciones + contactos (si los hay)
      const dataQuery = `
      SELECT 
        c.*, 
        d.did as direccion_did, d.data as direccion_data, 
        co.did as contacto_did, co.tipo as contacto_tipo, co.valor as contacto_valor
      FROM clientes c
      LEFT JOIN clientes_direcciones d ON d.didCliente = c.did AND d.elim = 0 AND d.superado = 0
      LEFT JOIN clientes_contactos co ON co.didCliente = c.did AND co.elim = 0  AND  co.superado = 0
      ${whereClause}
      ORDER BY c.did DESC
      LIMIT ? OFFSET ?
    `;

      const dataValues = [...values, cantidadPorPagina, offset];
      const results = await executeQuery(connection, dataQuery, dataValues);



      // Agrupar resultados por cliente
      const clientesMap = {};
      for (const row of results) {
        if (!clientesMap[row.did]) {
          clientesMap[row.did] = {
            did: row.did,
            nombre_fantasia: row.nombre_fantasia,
            habilitado: row.habilitado,
            codigo: row.codigo,
            observaciones: row.observaciones,
            razon_social: row.razon_social,
            quien: row.quien,
            contactos: [],
            direcciones: [],
          };
        }

        // Agregar dirección si no está duplicada
        if (
          row.direccion_did &&
          !clientesMap[row.did].direcciones.some(
            (d) => d.did === row.direccion_did
          )
        ) {
          clientesMap[row.did].direcciones.push({
            did: row.direccion_did,
            data: row.direccion_data,
          });
        }

        // Agregar contacto si no está duplicado
        if (
          row.contacto_did &&
          !clientesMap[row.did].contactos.some(
            (c) => c.did === row.contacto_did
          )
        ) {
          clientesMap[row.did].contactos.push({
            did: row.contacto_did,
            tipo: row.contacto_tipo,
            valor: row.contacto_valor,
          });
        }
      }



      return {
        totalRegistros,
        totalPaginas,
        pagina,
        cantidad: cantidadPorPagina,
        clientes: Object.values(clientesMap).sort((a, b) => b.did - a.did), // 👈 Orden descendente real por did
      };

    } catch (error) {
      console.error("Error en GETCLIENTES:", error.message);
      throw error;
    }
  }

  async getAll(connection) {
    try {
      const query = `
      SELECT 
        c.did AS cliente_did,
        c.codigo, 
        c.nombre_fantasia, 
        c.habilitado,
        
        cc.did AS cuenta_did, 
        cc.flex,
        cc.titulo

      FROM clientes c
      JOIN clientes_cuentas cc ON c.did = cc.didCliente AND cc.elim = 0 and cc.superado = 0
      WHERE c.elim = 0 AND c.superado = 0
      ORDER BY c.did DESC
    `;
      const rows = await executeQuery(connection, query, []);

      // Agrupar por cliente
      const clientesMap = new Map();

      for (const row of rows) {
        const clienteId = row.cliente_did;

        if (!clientesMap.has(clienteId)) {
          clientesMap.set(clienteId, {
            did: row.cliente_did,
            codigo: row.codigo,
            nombre_fantasia: row.nombre_fantasia,
            habilitado: row.habilitado,
            cuentas: [],
          });
        }

        clientesMap.get(clienteId).cuentas.push({
          did: row.cuenta_did,
          flex: row.flex,
          titulo: row.titulo || "",
        });
      }

      const resultados = Array.from(clientesMap.values());
      return resultados;
    } catch (error) {
      console.error("Error en GETCLIENTES:", error.message);
      throw error;
    }
  }

  async getClientesById(connection, did, idEmpresa) {
    let didCuenta = 0;
    try {
      const query = `
        SELECT 
          c.*, 
          d.did as direccion_did, d.data as direccion_data, c.razon_social, c.codigo,
          co.did as contacto_did, co.tipo as contacto_tipo, co.valor as contacto_valor,
          cc.did as cuenta_did, cc.flex as tipo, cc.data as cuenta_data,cc.titulo, cc.ml_id_vendedor, cc.ml_user, cc.depositos
        FROM clientes c
        LEFT JOIN clientes_direcciones d ON d.didCliente = c.did AND d.elim = 0 AND d.superado = 0
        LEFT JOIN clientes_contactos co ON co.didCliente = c.did AND co.elim = 0 AND co.superado = 0
        LEFT JOIN clientes_cuentas cc ON cc.didCliente = c.did AND cc.elim = 0 AND cc.superado = 0
        WHERE c.elim = 0 AND c.superado = 0 AND c.did = ?
      `;

      const results = await executeQuery(connection, query, [did]);
      if (results.length === 0) {
        return {
          estado: false,
          message: "No se encontró el cliente.",
        };
      }

      const cliente = {
        did: results[0].did,
        nombre_fantasia: results[0].nombre_fantasia,
        observaciones: results[0].observaciones || "",
        razon_social: results[0].razon_social,
        codigo: results[0].codigo,
        habilitado: results[0].habilitado,
        quien: results[0].quien,
        contactos: [],
        direcciones: [],
        cuentas: [],
      };

      for (const row of results) {
        if (
          row.direccion_did &&
          !cliente.direcciones.some((d) => d.did === row.direccion_did)
        ) {
          cliente.direcciones.push({
            did: row.direccion_did,
            data: row.direccion_data,
          });
        }

        if (
          row.contacto_did &&
          !cliente.contactos.some((c) => c.did === row.contacto_did)
        ) {
          cliente.contactos.push({
            did: row.contacto_did,
            tipo: row.contacto_tipo,
            valor: row.contacto_valor,
          });
        }

        if (
          row.cuenta_did &&
          !cliente.cuentas.some((cu) => cu.did === row.cuenta_did)
        ) {
          cliente.cuentas.push({
            did: row.cuenta_did,
            tipo: row.tipo,
            titulo: row.titulo,
            data: row.cuenta_data,
            ml_id_vendedor: row.ml_id_vendedor,
            ml_user: row.ml_user,
            depositos: row.depositos,
          });
        }
        didCuenta = row.cuenta_did;
      }

      const didcliente = results[0].did;
      const GLOBAL_empresa_id = idEmpresa;
      const pais = "AR"; // Simulando `$_SESSION["configuracion"]["pais"]`

      // Generar autofecha
      const now = new Date();
      const autofecha = now
        .toISOString()
        .replace(/[-T:.Z]/g, '') // Elimina símbolos y formato ISO
        .slice(0, 14) +           // YYYYMMDDHHMMSS
        generateToken4();         // Agrega el token aleatorio

      const data = {
        autofecha,
        didcliente,
        didCuenta,
        didempresa: GLOBAL_empresa_id,
        pais
      };
      const resultado = encodeArr(data)
      console.log(resultado, "data");

      // Agregar el token generado a la respuesta


      return cliente;
    } catch (error) {
      console.error("Error en GETCLIENTES BY ID:", error.message);
      throw error;
    }
  }
}

module.exports = Cliente;
