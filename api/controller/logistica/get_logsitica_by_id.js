import { executeQuery } from "lightdata-tools";

export async function getClienteById(connection, req) {
    const { clienteId } = req.params;

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

    const results = await executeQuery(connection, query, [clienteId]);
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
    }

    return cliente;
}