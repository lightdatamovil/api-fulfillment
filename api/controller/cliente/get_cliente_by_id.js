// clientes.controller.js
import { CustomException, executeQuery, Status } from "lightdata-tools";

export async function getClienteById({ db, req }) {
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
      d.titulo,
      d.localidad,

      d.calle,
      d.numero,
      d.provincia,
      d.cp,

      -- Contactos
      co.did AS contacto_did,
      co.tipo,
      co.valor,

      -- Cuentas
      cc.did AS cuenta_did,
      cc.flex AS cuenta_flex,
      cc.titulo AS cuenta_titulo,
      cc.ml_id_vendedor AS cuenta_ml_id_vendedor,
      cc.ml_user AS cuenta_ml_user,
      cc.data

    FROM clientes c
    LEFT JOIN clientes_direcciones d
      ON d.did_cliente = c.did AND d.elim = 0 AND d.superado = 0
    LEFT JOIN clientes_contactos co
      ON co.did_cliente = c.did AND co.elim = 0 AND co.superado = 0
    LEFT JOIN clientes_cuentas cc
      ON cc.did_cliente = c.did AND cc.elim = 0 AND cc.superado = 0
    WHERE c.elim = 0
      AND c.superado = 0
      AND c.did = ?
  `;

    const rows = await executeQuery({ db, query: sql, values: [clienteId] });

    if (!rows?.length) {
        throw new CustomException({
            title: "Cliente no encontrado",
            message: "Cliente no encontrado con el ID proporcionado",
            status: Status.notFound,
        })
    }

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
    };

    const dirSet = new Set();
    const conSet = new Set();
    const ctaSet = new Set();

    for (const r of rows) {
        if (r.direccion_did && !dirSet.has(r.direccion_did)) {
            dirSet.add(r.direccion_did);
            cliente.direcciones.push({
                did: r.direccion_did,
                address_line: r.address_line,
                localidad: r.localidad,
                provincia: r.provincia,
                calle: r.calle,
                numero: r.numero,
                cp: r.cp,
                titulo: r.titulo,
            });
        }

        if (r.contacto_did && !conSet.has(r.contacto_did)) {
            conSet.add(r.contacto_did);
            cliente.contactos.push({
                did: r.contacto_did,
                tipo: r.tipo || 0,
                valor: r.valor || null,

            });
        }

        if (r.cuenta_did && !ctaSet.has(r.cuenta_did)) {
            ctaSet.add(r.cuenta_did);
            cliente.cuentas.push({
                did: r.cuenta_did,
                flex: r.cuenta_flex,
                titulo: r.cuenta_titulo,
                ml_id_vendedor: r.cuenta_ml_id_vendedor,
                ml_user: r.cuenta_ml_user,
                data: r.data ? JSON.parse(r.data) : null,
            });
        }
    }

    return {
        success: true,
        message: "Cliente obtenido correctamente",
        data: cliente,
        meta: { timestamp: new Date().toISOString() },
    };
}
