// clientes.controller.js (ESM)
import { executeQuery } from "lightdata-tools";

/**
 * PUT /api/clientes/:clienteId
 * Body (root): nombre_fantasia, razon_social, codigo, observaciones, habilitado
 * Nested: direcciones { add[], update[], remove[] }, contactos { ... }, cuentas { ... }
 * Estrategia: VERSIONADO (no UPDATE in-place)
 *  - marcar vigente como superado=1
 *  - insertar nuevo registro con el MISMO did
 */
export async function editCliente(connection, req) {
    const { clienteId } = req.params;
    const body = req.body || {};
    const nowUser = Number(req.user?.id ?? 0);

    const ensureArr = (x) => (Array.isArray(x) ? x : []);
    const dAdd = ensureArr(body?.direcciones?.add);
    const dUpd = ensureArr(body?.direcciones?.update);
    const dDel = ensureArr(body?.direcciones?.remove);

    const cAdd = ensureArr(body?.contactos?.add);
    const cUpd = ensureArr(body?.contactos?.update);
    const cDel = ensureArr(body?.contactos?.remove);

    const aAdd = ensureArr(body?.cuentas?.add);
    const aUpd = ensureArr(body?.cuentas?.update);
    const aDel = ensureArr(body?.cuentas?.remove);

    const changed = {
        cliente: 0,
        direcciones: { added: 0, updated: 0, removed: 0 },
        contactos: { added: 0, updated: 0, removed: 0 },
        cuentas: { added: 0, updated: 0, removed: 0 },
    };

    // helpers -------------->
    const fetchClienteVigente = async () => {
        const rows = await executeQuery(
            connection,
            `SELECT did, nombre_fantasia, razon_social, codigo, observaciones, habilitado
         FROM clientes
        WHERE did = ? AND superado = 0 AND elim = 0
        LIMIT 1`,
            [clienteId]
        );
        return rows?.[0] || null;
    };

    const fetchDirByDid = async (didDireccion) => {
        const rows = await executeQuery(
            connection,
            `SELECT *
         FROM clientes_direcciones
        WHERE did = ? AND did_cliente = ? AND superado = 0 AND elim = 0
        LIMIT 1`,
            [didDireccion, clienteId]
        );
        return rows?.[0] || null;
    };

    const fetchConByDid = async (didContacto) => {
        const rows = await executeQuery(
            connection,
            `SELECT *
         FROM clientes_contactos
        WHERE did = ? AND did_cliente = ? AND superado = 0 AND elim = 0
        LIMIT 1`,
            [didContacto, clienteId]
        );
        return rows?.[0] || null;
    };

    const fetchCtaByDid = async (didCuenta) => {
        const rows = await executeQuery(
            connection,
            `SELECT *
         FROM clientes_cuentas
        WHERE did = ? AND did_cliente = ? AND superado = 0 AND elim = 0
        LIMIT 1`,
            [didCuenta, clienteId]
        );
        return rows?.[0] || null;
    };

    // versionar registro genérico (marca superado e inserta con mismo did)
    const superarVigente = async (table, whereCols, whereVals) => {
        const where = whereCols.map((c) => `${c} = ?`).join(" AND ");
        await executeQuery(
            connection,
            `UPDATE ${table}
          SET superado = 1, quien = ?
        WHERE ${where} AND superado = 0 AND elim = 0`,
            [nowUser || null, ...whereVals]
        );
    };

    const insertWithSameDid = async (table, cols, vals, fixedDid) => {
        // Insert con did explícito (= fixedDid)
        const colsWithDid = ["did", ...cols];
        const ph = ["?", ...cols.map(() => "?")];
        const res = await executeQuery(
            connection,
            `INSERT INTO ${table} (${colsWithDid.join(",")}) VALUES (${ph.join(",")})`,
            [fixedDid, ...vals],
            true
        );
        return res?.insertId || 0;
    };

    // <-------------- helpers

    await executeQuery(connection, "START TRANSACTION");
    try {
        // validar cliente vigente
        const vigente = await fetchClienteVigente();
        if (!vigente) {
            await executeQuery(connection, "ROLLBACK");
            return {
                success: false,
                message: "Cliente no encontrado o no vigente",
                data: null,
                meta: null,
            };
        }

        // -----------------------------
        // CLIENTE (root del body)
        // Si hay algún campo base en el body, versionamos cliente.
        const baseFields = ["nombre_fantasia", "razon_social", "codigo", "observaciones", "habilitado"];
        const someBasePatch = baseFields.some((k) => body[k] !== undefined);
        if (someBasePatch) {
            // merge (patch sobre vigente)
            const merged = {
                nombre_fantasia: body.nombre_fantasia ?? vigente.nombre_fantasia ?? null,
                razon_social: body.razon_social ?? vigente.razon_social ?? null,
                codigo: body.codigo ?? vigente.codigo ?? null,
                observaciones: body.observaciones ?? vigente.observaciones ?? null,
                habilitado: body.habilitado ?? vigente.habilitado ?? 0,
            };

            // superar vigente e insertar nueva versión con el MISMO did
            await superarVigente("clientes", ["did"], [clienteId]);

            const cols = [
                "nombre_fantasia", "razon_social", "codigo", "observaciones",
                "habilitado", "quien", "superado", "elim"
            ];
            const vals = [
                merged.nombre_fantasia, merged.razon_social, merged.codigo, merged.observaciones,
                Number(merged.habilitado ?? 0), nowUser || null, 0, 0
            ];
            await insertWithSameDid("clientes", cols, vals, Number(clienteId));
            changed.cliente = 1;
        }

        // -----------------------------
        // DIRECCIONES
        // ADD: inserta con did=auto (did=0 -> set did=id) o directamente con did=id?
        // -> como es ALTA "nueva", dejamos el patrón habitual: did=0 y luego set did=id.
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

        // UPDATE: versionado por did (supera e inserta con MISMO did)
        for (const d of dUpd) {
            if (!d.did) continue;
            const cur = await fetchDirByDid(d.did);
            if (!cur) continue;

            const merged = {
                did_cliente: clienteId,
                address_line: d.address_line ?? cur.address_line ?? null,
                pais: d.pais ?? cur.pais ?? null,
                localidad: d.localidad ?? cur.localidad ?? null,
                numero: d.numero ?? cur.numero ?? null,
                calle: d.calle ?? cur.calle ?? null,
                cp: d.cp ?? cur.cp ?? null,
                provincia: d.provincia ?? cur.provincia ?? null,
                titulo: d.titulo ?? cur.titulo ?? null,
            };

            await superarVigente("clientes_direcciones", ["did_cliente", "did"], [clienteId, d.did]);

            const cols = [
                "did_cliente", "address_line", "pais", "localidad", "numero",
                "calle", "cp", "provincia", "titulo", "quien", "superado", "elim"
            ];
            const vals = [
                merged.did_cliente, merged.address_line, merged.pais, merged.localidad, merged.numero,
                merged.calle, merged.cp, merged.provincia, merged.titulo, nowUser || null, 0, 0
            ];
            await insertWithSameDid("clientes_direcciones", cols, vals, Number(d.did));
            changed.direcciones.updated++;
        }

        // REMOVE: elim=1 al vigente por did
        if (dDel.length) {
            await executeQuery(
                connection,
                `UPDATE clientes_direcciones
            SET elim = 1, quien = ?
          WHERE did_cliente = ?
            AND did IN (${dDel.map(() => "?").join(",")})
            AND superado = 0`,
                [nowUser || null, clienteId, ...dDel]
            );
            changed.direcciones.removed = dDel.length;
        }

        // -----------------------------
        // CONTACTOS
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

        for (const c of cUpd) {
            if (!c.did) continue;
            const cur = await fetchConByDid(c.did);
            if (!cur) continue;

            const merged = {
                did_cliente: clienteId,
                tipo: c.tipo ?? cur.tipo ?? 0,
                valor: c.valor ?? cur.valor ?? null,
            };

            await superarVigente("clientes_contactos", ["did_cliente", "did"], [clienteId, c.did]);

            const cols = ["did_cliente", "tipo", "valor", "quien", "superado", "elim"];
            const vals = [merged.did_cliente, merged.tipo, merged.valor, nowUser || null, 0, 0];
            await insertWithSameDid("clientes_contactos", cols, vals, Number(c.did));
            changed.contactos.updated++;
        }

        if (cDel.length) {
            await executeQuery(
                connection,
                `UPDATE clientes_contactos
            SET elim = 1, quien = ?
          WHERE did_cliente = ?
            AND did IN (${cDel.map(() => "?").join(",")})
            AND superado = 0`,
                [nowUser || null, clienteId, ...cDel]
            );
            changed.contactos.removed = cDel.length;
        }

        // -----------------------------
        // CUENTAS (ojo: ml_id_vendedor usualmente NOT NULL; si no viene en update, se hereda)
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
                    String(a.ml_id_vendedor ?? ""),  // evitar null
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

        for (const a of aUpd) {
            if (!a.did) continue;
            const cur = await fetchCtaByDid(a.did);
            if (!cur) continue;

            const merged = {
                did_cliente: clienteId,
                flex: Number(a.flex ?? cur.flex ?? 0),
                titulo: a.titulo ?? cur.titulo ?? null,
                ml_id_vendedor: String(a.ml_id_vendedor ?? cur.ml_id_vendedor ?? ""),
                ml_user: a.ml_user ?? cur.ml_user ?? null,
                data: a.data ?? cur.data ?? null,
            };

            await superarVigente("clientes_cuentas", ["did_cliente", "did"], [clienteId, a.did]);

            const cols = [
                "did_cliente", "flex", "titulo", "ml_id_vendedor", "ml_user", "data", "quien", "superado", "elim"
            ];
            const vals = [
                merged.did_cliente, merged.flex, merged.titulo, merged.ml_id_vendedor, merged.ml_user,
                merged.data, nowUser || null, 0, 0
            ];
            await insertWithSameDid("clientes_cuentas", cols, vals, Number(a.did));
            changed.cuentas.updated++;
        }

        if (aDel.length) {
            await executeQuery(
                connection,
                `UPDATE clientes_cuentas
            SET elim = 1, quien = ?
          WHERE did_cliente = ?
            AND did IN (${aDel.map(() => "?").join(",")})
            AND superado = 0`,
                [nowUser || null, clienteId, ...aDel]
            );
            changed.cuentas.removed = aDel.length;
        }

        await executeQuery(connection, "COMMIT");
        return {
            success: true,
            message: "Cliente actualizado (versionado) correctamente",
            data: { did: Number(clienteId) },
            meta: { changed },
        };
    } catch (err) {
        await executeQuery(connection, "ROLLBACK");
        return {
            success: false,
            message: err?.message || "Error actualizando cliente",
            data: null,
            meta: { changed },
        };
    }
}
