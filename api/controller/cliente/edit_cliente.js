// clientes.controller.js (ESM, simple y directo)
import { executeQuery } from "lightdata-tools";

/**
 * PUT /api/clientes/:clienteId
 * Body: root { nombre_fantasia, razon_social, codigo, observaciones, habilitado }
 *        direcciones { add[], update[], remove[] }
 *        contactos   { add[], update[], remove[] }
 *        cuentas     { add[], update[], remove[] }
 * Estrategia: versionado (superado=1 e insert con mismo did). Sin transacciones.
 *
 * Cambio: "remove" ahora se procesa como un update versionado: se supera la fila vigente
 *         e inserta NUEVA versión con elim=1 (manteniendo el mismo did).
 */
export async function editCliente(connection, req) {
    const { clienteId } = req.params;
    const body = req.body || {};
    const nowUser = Number(req.user?.id ?? 0);

    const arr = (x) => (Array.isArray(x) ? x : []);
    const dAdd = arr(body?.direcciones?.add);
    const dUpd = arr(body?.direcciones?.update);
    const dDel = arr(body?.direcciones?.remove);

    const cAdd = arr(body?.contactos?.add);
    const cUpd = arr(body?.contactos?.update);
    const cDel = arr(body?.contactos?.remove);

    const aAdd = arr(body?.cuentas?.add);
    const aUpd = arr(body?.cuentas?.update);
    const aDel = arr(body?.cuentas?.remove);

    const changed = {
        cliente: 0,
        direcciones: { added: 0, updated: 0, removed: 0 },
        contactos: { added: 0, updated: 0, removed: 0 },
        cuentas: { added: 0, updated: 0, removed: 0 },
    };

    // helper para normalizar entradas de remove: acepta [did] o [{did}]
    const normalizeRemoveList = (list) =>
        list
            .map((x) => (typeof x === "object" ? Number(x?.did ?? 0) : Number(x)))
            .filter((n) => Number.isFinite(n) && n > 0);

    try {
        // 1) Traer vigente del cliente
        const vigenteRows = await executeQuery(
            connection,
            `SELECT did, nombre_fantasia, razon_social, codigo, observaciones, habilitado
       FROM clientes
       WHERE did = ? AND superado = 0 AND elim = 0
       LIMIT 1`,
            [clienteId]
        );
        const vigente = vigenteRows?.[0] || null;
        if (!vigente) {
            return { success: false, message: "Cliente no encontrado o no vigente", data: null, meta: null };
        }

        // 2) Cliente (root)
        const baseFields = ["nombre_fantasia", "razon_social", "codigo", "observaciones", "habilitado"];
        const hayPatch = baseFields.some((k) => body[k] !== undefined);
        if (hayPatch) {
            const nombre_fantasia = body.nombre_fantasia ?? vigente.nombre_fantasia ?? null;
            const razon_social = body.razon_social ?? vigente.razon_social ?? null;
            const codigo = body.codigo ?? vigente.codigo ?? null;
            const observaciones = body.observaciones ?? vigente.observaciones ?? null;
            const habilitado = Number(body.habilitado ?? vigente.habilitado ?? 0);

            // superar vigente
            await executeQuery(
                connection,
                `UPDATE clientes SET superado = 1, quien = ?
         WHERE did = ? AND superado = 0 AND elim = 0`,
                [nowUser || null, clienteId]
            );

            // insertar nueva versión con MISMO did
            await executeQuery(
                connection,
                `INSERT INTO clientes
         (did, nombre_fantasia, razon_social, codigo, observaciones, habilitado, quien, superado, elim)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
                [Number(clienteId), nombre_fantasia, razon_social, codigo, observaciones, habilitado, nowUser || null],
                true
            );

            changed.cliente = 1;
        }

        // 3) Direcciones
        // add
        for (const d of dAdd) {
            const ins = await executeQuery(
                connection,
                `INSERT INTO clientes_direcciones
         (did, did_cliente, address_line, pais, localidad, numero, calle, cp, provincia, titulo, quien, superado, elim)
         VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
                [
                    clienteId,
                    d.address_line ?? null,
                    d.pais ?? null,
                    d.localidad ?? null,
                    d.numero ?? null,
                    d.calle ?? null,
                    d.cp ?? null,
                    d.provincia ?? null,
                    d.titulo ?? null,
                    nowUser || null,
                ],
                true
            );
            const newId = ins?.insertId || 0;
            if (newId) {
                await executeQuery(connection, `UPDATE clientes_direcciones SET did = ? WHERE id = ?`, [newId, newId]);
            }
            changed.direcciones.added++;
        }

        // update (versionado por did)
        for (const d of dUpd) {
            if (!d?.did) continue;

            const curRows = await executeQuery(
                connection,
                `SELECT * FROM clientes_direcciones
         WHERE did = ? AND did_cliente = ? AND superado = 0 AND elim = 0
         LIMIT 1`,
                [d.did, clienteId]
            );
            const cur = curRows?.[0];
            if (!cur) continue;

            const address_line = d.address_line ?? cur.address_line ?? null;
            const pais = d.pais ?? cur.pais ?? null;
            const localidad = d.localidad ?? cur.localidad ?? null;
            const numero = d.numero ?? cur.numero ?? null;
            const calle = d.calle ?? cur.calle ?? null;
            const cp = d.cp ?? cur.cp ?? null;
            const provincia = d.provincia ?? cur.provincia ?? null;
            const titulo = d.titulo ?? cur.titulo ?? null;

            await executeQuery(
                connection,
                `UPDATE clientes_direcciones
         SET superado = 1, quien = ?
         WHERE did_cliente = ? AND did = ? AND superado = 0 AND elim = 0`,
                [nowUser || null, clienteId, d.did]
            );

            await executeQuery(
                connection,
                `INSERT INTO clientes_direcciones
         (did, did_cliente, address_line, pais, localidad, numero, calle, cp, provincia, titulo, quien, superado, elim)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
                [
                    Number(d.did),
                    clienteId,
                    address_line,
                    pais,
                    localidad,
                    numero,
                    calle,
                    cp,
                    provincia,
                    titulo,
                    nowUser || null,
                ],
                true
            );

            changed.direcciones.updated++;
        }

        // remove (versionado: supera e inserta nueva versión con elim=1)
        for (const did of normalizeRemoveList(dDel)) {
            const curRows = await executeQuery(
                connection,
                `SELECT * FROM clientes_direcciones
         WHERE did = ? AND did_cliente = ? AND superado = 0 AND elim = 0
         LIMIT 1`,
                [did, clienteId]
            );
            const cur = curRows?.[0];
            if (!cur) continue;

            await executeQuery(
                connection,
                `UPDATE clientes_direcciones
         SET superado = 1, quien = ?
         WHERE did_cliente = ? AND did = ? AND superado = 0 AND elim = 0`,
                [nowUser || null, clienteId, did]
            );

            await executeQuery(
                connection,
                `INSERT INTO clientes_direcciones
         (did, did_cliente, address_line, pais, localidad, numero, calle, cp, provincia, titulo, quien, superado, elim)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
                [
                    Number(did),
                    clienteId,
                    cur.address_line ?? null,
                    cur.pais ?? null,
                    cur.localidad ?? null,
                    cur.numero ?? null,
                    cur.calle ?? null,
                    cur.cp ?? null,
                    cur.provincia ?? null,
                    cur.titulo ?? null,
                    nowUser || null,
                ],
                true
            );

            changed.direcciones.removed++;
        }

        // 4) Contactos
        // add
        for (const c of cAdd) {
            const ins = await executeQuery(
                connection,
                `INSERT INTO clientes_contactos
         (did, did_cliente, tipo, valor, quien, superado, elim)
         VALUES (0, ?, ?, ?, ?, 0, 0)`,
                [clienteId, Number(c.tipo ?? 0), c.valor ?? null, nowUser || null],
                true
            );
            const newId = ins?.insertId || 0;
            if (newId) {
                await executeQuery(connection, `UPDATE clientes_contactos SET did = ? WHERE id = ?`, [newId, newId]);
            }
            changed.contactos.added++;
        }

        // update
        for (const c of cUpd) {
            if (!c?.did) continue;

            const curRows = await executeQuery(
                connection,
                `SELECT * FROM clientes_contactos
         WHERE did = ? AND did_cliente = ? AND superado = 0 AND elim = 0
         LIMIT 1`,
                [c.did, clienteId]
            );
            const cur = curRows?.[0];
            if (!cur) continue;

            const tipo = Number(c.tipo ?? cur.tipo ?? 0);
            const valor = c.valor ?? cur.valor ?? null;

            await executeQuery(
                connection,
                `UPDATE clientes_contactos
         SET superado = 1, quien = ?
         WHERE did_cliente = ? AND did = ? AND superado = 0 AND elim = 0`,
                [nowUser || null, clienteId, c.did]
            );

            await executeQuery(
                connection,
                `INSERT INTO clientes_contactos
         (did, did_cliente, tipo, valor, quien, superado, elim)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
                [Number(c.did), clienteId, tipo, valor, nowUser || null],
                true
            );

            changed.contactos.updated++;
        }

        // remove (versionado: supera e inserta nueva versión con elim=1)
        for (const did of normalizeRemoveList(cDel)) {
            const curRows = await executeQuery(
                connection,
                `SELECT * FROM clientes_contactos
         WHERE did = ? AND did_cliente = ? AND superado = 0 AND elim = 0
         LIMIT 1`,
                [did, clienteId]
            );
            const cur = curRows?.[0];
            if (!cur) continue;

            await executeQuery(
                connection,
                `UPDATE clientes_contactos
         SET superado = 1, quien = ?
         WHERE did_cliente = ? AND did = ? AND superado = 0 AND elim = 0`,
                [nowUser || null, clienteId, did]
            );

            await executeQuery(
                connection,
                `INSERT INTO clientes_contactos
         (did, did_cliente, tipo, valor, quien, superado, elim)
         VALUES (?, ?, ?, ?, ?, 0, 1)`,
                [Number(did), clienteId, cur.tipo ?? 0, cur.valor ?? null, nowUser || null],
                true
            );

            changed.contactos.removed++;
        }

        // 5) Cuentas
        // add
        for (const a of aAdd) {
            const ins = await executeQuery(
                connection,
                `INSERT INTO clientes_cuentas
         (did, did_cliente, flex, titulo, ml_id_vendedor, ml_user, data, quien, superado, elim)
         VALUES (0, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
                [
                    clienteId,
                    Number(a.flex ?? 0),
                    a.titulo ?? null,
                    String(a.ml_id_vendedor ?? ""),
                    a.ml_user ?? null,
                    a.data ?? null,
                    nowUser || null,
                ],
                true
            );
            const newId = ins?.insertId || 0;
            if (newId) {
                await executeQuery(connection, `UPDATE clientes_cuentas SET did = ? WHERE id = ?`, [newId, newId]);
            }
            changed.cuentas.added++;
        }

        // update
        for (const a of aUpd) {
            if (!a?.did) continue;

            const curRows = await executeQuery(
                connection,
                `SELECT * FROM clientes_cuentas
         WHERE did = ? AND did_cliente = ? AND superado = 0 AND elim = 0
         LIMIT 1`,
                [a.did, clienteId]
            );
            const cur = curRows?.[0];
            if (!cur) continue;

            const flex = Number(a.flex ?? cur.flex ?? 0);
            const titulo = a.titulo ?? cur.titulo ?? null;
            const ml_id_vendedor = String(a.ml_id_vendedor ?? cur.ml_id_vendedor ?? "");
            const ml_user = a.ml_user ?? cur.ml_user ?? null;
            const data = a.data ?? cur.data ?? null;

            await executeQuery(
                connection,
                `UPDATE clientes_cuentas
         SET superado = 1, quien = ?
         WHERE did_cliente = ? AND did = ? AND superado = 0 AND elim = 0`,
                [nowUser || null, clienteId, a.did]
            );

            await executeQuery(
                connection,
                `INSERT INTO clientes_cuentas
         (did, did_cliente, flex, titulo, ml_id_vendedor, ml_user, data, quien, superado, elim)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
                [Number(a.did), clienteId, flex, titulo, ml_id_vendedor, ml_user, data, nowUser || null],
                true
            );

            changed.cuentas.updated++;
        }

        // remove (versionado: supera e inserta nueva versión con elim=1)
        for (const did of normalizeRemoveList(aDel)) {
            const curRows = await executeQuery(
                connection,
                `SELECT * FROM clientes_cuentas
         WHERE did = ? AND did_cliente = ? AND superado = 0 AND elim = 0
         LIMIT 1`,
                [did, clienteId]
            );
            const cur = curRows?.[0];
            if (!cur) continue;

            await executeQuery(
                connection,
                `UPDATE clientes_cuentas
         SET superado = 1, quien = ?
         WHERE did_cliente = ? AND did = ? AND superado = 0 AND elim = 0`,
                [nowUser || null, clienteId, did]
            );

            await executeQuery(
                connection,
                `INSERT INTO clientes_cuentas
         (did, did_cliente, flex, titulo, ml_id_vendedor, ml_user, data, quien, superado, elim)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
                [
                    Number(did),
                    clienteId,
                    Number(cur.flex ?? 0),
                    cur.titulo ?? null,
                    String(cur.ml_id_vendedor ?? ""),
                    cur.ml_user ?? null,
                    cur.data ?? null,
                    nowUser || null,
                ],
                true
            );

            changed.cuentas.removed++;
        }

        return {
            success: true,
            message: "Cliente actualizado (versionado) correctamente",
            data: { did: Number(clienteId) },
            meta: { changed },
        };
    } catch (err) {
        return {
            success: false,
            message: err?.message || "Error actualizando cliente",
            data: null,
            meta: { changed },
        };
    }
}
