import { executeQuery } from "lightdata-tools";

function encodeArr(data) {
  const json = JSON.stringify(data);
  const base64 = Buffer.from(json).toString('base64');
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
  }

  async createNewRecord(connection) {
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
  }

  async delete(connection, did) {
    const deleteQuery = "UPDATE clientes SET elim = 1 WHERE did = ?";
    await executeQuery(connection, deleteQuery, [did]);
    return {
      estado: true,
      message: "Producto eliminado correctamente.",
    };
  }
  async getClientes(connection, filtros) {
    const conditions = ["c.superado = 0 AND c.elim = 0"];
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
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const pagina = Number(filtros.pagina) || 1;
    const cantidadPorPagina = Number(filtros.cantidad) || 10;
    const offset = (pagina - 1) * cantidadPorPagina;

    const totalQuery = `SELECT COUNT(*) as total FROM clientes ${whereClause.replace(/c\./g, "")}`;
    const totalResult = await executeQuery(connection, totalQuery, values);
    const totalRegistros = totalResult[0].total;
    const totalPaginas = Math.ceil(totalRegistros / cantidadPorPagina);

    const clientesQuery = `
        SELECT c.* FROM clientes c
        ${whereClause}
        ORDER BY c.did DESC
        LIMIT ? OFFSET ?
      `;
    const clientes = await executeQuery(connection, clientesQuery, [...values, cantidadPorPagina, offset]);

    if (clientes.length === 0) {
      return {
        totalRegistros,
        totalPaginas,
        pagina,
        cantidad: cantidadPorPagina,
        clientes: [],
      };
    }

    const dids = clientes.map(c => c.did);

    const direccionesQuery = `
        SELECT did, didCliente, data 
        FROM clientes_direcciones 
        WHERE didCliente IN (${dids.map(() => '?').join(',')}) AND elim = 0 AND superado = 0
      `;
    const direcciones = await executeQuery(connection, direccionesQuery, dids);

    const contactosQuery = `
        SELECT did, didCliente, tipo, valor 
        FROM clientes_contactos 
        WHERE didCliente IN (${dids.map(() => '?').join(',')}) AND elim = 0 AND superado = 0
      `;
    const contactos = await executeQuery(connection, contactosQuery, dids);

    const clientesFinal = clientes.map(cliente => {
      const clienteDirecciones = direcciones.filter(d => d.didCliente === cliente.did)
        .map(d => ({ did: d.did, data: d.data }));
      const clienteContactos = contactos.filter(c => c.didCliente === cliente.did)
        .map(c => ({ did: c.did, tipo: c.tipo, valor: c.valor }));

      return {
        did: cliente.did,
        nombre_fantasia: cliente.nombre_fantasia,
        habilitado: cliente.habilitado,
        codigo: cliente.codigo,
        observaciones: cliente.observaciones,
        razon_social: cliente.razon_social,
        quien: cliente.quien,
        contactos: clienteContactos,
        direcciones: clienteDirecciones,
      };
    });

    return {
      totalRegistros,
      totalPaginas,
      pagina,
      cantidad: cantidadPorPagina,
      clientes: clientesFinal,
    };

  }


  async getAll(connection) {
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
      LEFT JOIN clientes_cuentas cc ON c.did = cc.didCliente AND cc.elim = 0 and cc.superado = 0
      WHERE c.elim = 0 AND c.superado = 0
      ORDER BY c.did DESC
    `;
    const rows = await executeQuery(connection, query, []);

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
  }

  async getClientesById(connection, did, idEmpresa) {
    let didCuenta = 0;
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
    const pais = "AR";

    const now = new Date();
    const autofecha = now
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14) +
      generateToken4();

    const data = {
      autofecha,
      didcliente,
      didCuenta,
      didempresa: GLOBAL_empresa_id,
      pais
    };
    const resultado = encodeArr(data)

    return cliente;
  }
}

export default Cliente;
