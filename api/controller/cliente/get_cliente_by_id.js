// clientes.controller.js
import { executeQuery } from "lightdata-tools";

export async function getClienteById(connection, req) {
    const { clienteId } = req.params;

    const sql = `
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
      cc.flex AS cuenta_flex,
      cc.titulo AS cuenta_titulo,
      cc.ml_id_vendedor AS cuenta_ml_id_vendedor,
      cc.ml_user AS cuenta_ml_user,

      -- Depósitos (ojo: FK correcta es a la cuenta)
      cd.did AS deposito_did,
      cd.did_deposito
    FROM clientes c
    LEFT JOIN clientes_direcciones d
      ON d.did_cliente = c.did AND d.elim = 0 AND d.superado = 0
    LEFT JOIN clientes_contactos co
      ON co.did_cliente = c.did AND co.elim = 0 AND co.superado = 0
    LEFT JOIN clientes_cuentas cc
      ON cc.did_cliente = c.did AND cc.elim = 0 AND cc.superado = 0
    LEFT JOIN clientes_cuentas_depositos cd
      ON cd.did_cliente_cuenta = cc.did AND cd.elim = 0 AND cd.superado = 0
    WHERE c.elim = 0
      AND c.superado = 0
      AND c.did = ?
  `;

    const rows = await executeQuery(connection, sql, [clienteId]);

    if (!rows?.length) {
        return {
            success: false,
            message: "No se encontró el cliente.",
            data: null,
            meta: null,
        };
    }

    // base del cliente
    const base = rows[0];
    const cliente = {
        did: base.did,
        nombre_fantasia: base.nombre_fantasia,
        observaciones: base.observaciones || "",
        razon_social: base.razon_social,
        codigo: base.codigo,
        habilitado: base.habilitado,
        quien: base.quien,
        direcciones: [],
        contactos: [],
        cuentas: [],
        depositos: [], // a nivel raíz como pediste
    };

    // sets para evitar duplicados
    const dirSet = new Set();
    const conSet = new Set();
    const ctaSet = new Set();
    const depSet = new Set();

    for (const r of rows) {
        // direcciones
        if (r.direccion_did && !dirSet.has(r.direccion_did)) {
            dirSet.add(r.direccion_did);
            cliente.direcciones.push({
                did: r.direccion_did,
                address_line: r.address_line,
                localidad: r.localidad,
                pais: r.pais,
                cp: r.cp,
            });
        }

        // contactos
        if (r.contacto_did && !conSet.has(r.contacto_did)) {
            conSet.add(r.contacto_did);
            cliente.contactos.push({
                did: r.contacto_did,
                telefono: r.telefono,
                email: r.email,
            });
        }

        // cuentas
        if (r.cuenta_did && !ctaSet.has(r.cuenta_did)) {
            ctaSet.add(r.cuenta_did);
            cliente.cuentas.push({
                did: r.cuenta_did,
                tipo: r.cuenta_flex,                 // campo real: flex (boolean/int)
                titulo: r.cuenta_titulo,
                ml_id_vendedor: r.cuenta_ml_id_vendedor,
                ml_user: r.cuenta_ml_user,
            });
        }

        // depósitos (a nivel raíz)
        if (r.deposito_did && !depSet.has(r.deposito_did)) {
            depSet.add(r.deposito_did);
            cliente.depositos.push({
                did: r.deposito_did,
                did_deposito: r.did_deposito,
                did_cliente_cuenta: r.cuenta_did ?? null, // útil para saber a qué cuenta pertenece
            });
        }
    }

    return {
        success: true,
        message: "Cliente obtenido correctamente",
        data: cliente,
        meta: [],
    };
}
