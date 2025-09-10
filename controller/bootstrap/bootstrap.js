import { executeQuery } from "lightdata-tools"

export async function preloader(dbConnection) {

    const queryProductos = `
          SELECT p.did AS did, p.didCliente, p.sku, p.titulo, p.ean, p.habilitado, p.esCombo, p.cm3
          FROM productos AS p
          WHERE p.elim = 0 AND p.superado = 0
          ORDER BY p.did DESC
        `;
    const productos = await executeQuery(dbConnection, queryProductos);

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
    const results = await executeQuery(dbConnection, selectQuery, []);

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

    const atributos = Array.from(atributosMap.values());

    const queryInsumos = ` SELECT * FROM insumos
        WHERE elim = 0 AND superado = 0
        ORDER BY did DESC
        `;
    const insumos = await executeQuery(dbConnection, queryInsumos, []);

    const queryClientes = `
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
    const rows = await executeQuery(dbConnection, queryClientes, []);

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

    const clientes = Array.from(clientesMap.values());

    return {
        success: true,
        message: "Datos pre-cargados correctamente",
        data: {
            productos,
            atributos,
            insumos,
            clientes
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}