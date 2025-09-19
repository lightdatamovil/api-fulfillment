import { executeQuery } from "lightdata-tools";

export async function getClienteById(connection, req) {
    const { clienteId } = req.params;

    const query = `
    SELECT
     
      c.did,
      c.nombre_fantasia,
      c.observaciones,
      c.razon_social,
      c.codigo,
      c.habilitado,
      c.quien,

      -- Direcciones
      d.did AS direccion_did,
      d.address_line,
      d.localidad,
      d.pais,
      d.cp,

      -- Contactos
      co.did AS contacto_did,
      co.telefono,
      co.email AS email,

      -- Cuentas
      cc.did AS cuenta_did,
      cc.flex AS tipo,
      cc.data AS cuenta_data,
      cc.titulo,
      cc.ml_id_vendedor,
      cc.ml_user,

      -- Depósitos
      cd.did AS deposito_did,
      cd.did_deposito
    FROM clientes c
    LEFT JOIN clientes_direcciones d
      ON d.did_cliente = c.did
     AND d.elim = 0
     AND d.superado = 0
    LEFT JOIN clientes_contactos co
      ON co.did_cliente = c.did
     AND co.elim = 0
     AND co.superado = 0
    LEFT JOIN clientes_cuentas cc
      ON cc.did_cliente = c.did
     AND cc.elim = 0
     AND cc.superado = 0
    LEFT JOIN clientes_cuentas_depositos cd
      ON cd.did_cliente_cuenta = c.did           -- <<--- confirmá que la FK correcta es cc.did
     AND cd.elim = 0
     AND cd.superado = 0
    WHERE c.elim = 0
      AND c.superado = 0
      AND c.did = ?
  `;

    const results = await executeQuery(connection, query, [clienteId]);

    if (results.length === 0) {
        return { estado: false, message: "No se encontró el cliente." };
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
        depositos: [],
    };

    for (const row of results) {
        if (row.direccion_did && !cliente.direcciones.some(d => d.did === row.direccion_did)) {
            cliente.direcciones.push({
                did: row.direccion_did,
                address_line: row.address_line,
                localidad: row.localidad,
                pais: row.pais,
                cp: row.cp,
            });
        }

        if (row.contacto_did && !cliente.contactos.some(c => c.did === row.contacto_did)) {
            cliente.contactos.push({
                did: row.contacto_did,
                telefono: row.telefono,
                email: row.email,
            });
        }

        if (row.cuenta_did && !cliente.cuentas.some(cu => cu.did === row.cuenta_did)) {
            cliente.cuentas.push({
                did: row.cuenta_did,
                tipo: row.tipo,
                titulo: row.titulo,
                data: row.cuenta_data,
                ml_id_vendedor: row.ml_id_vendedor,
                ml_user: row.ml_user,
            });
        }

        if (row.deposito_did && !cliente.depositos.some(dep => dep.did === row.deposito_did)) {
            cliente.depositos.push({
                did: row.deposito_did,
                did_deposito: row.did_deposito,
            });
        }
    }

    return cliente;
}
