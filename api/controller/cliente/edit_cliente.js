// clientes.controller.js (ESM)
import { LightdataQuerys } from "lightdata-tools";

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
export async function editCliente(dbConnection, req) {
    const { clienteId } = req.params;
    const body = req.body || {};
    const { userId } = req.user ?? {};

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
        const [vigente] = await LightdataQuerys.select({
            dbConnection,
            table: "clientes",
            column: "did",
            value: clienteId,
            throwExceptionIfNotExists: true,
        });

        if (!(Number(vigente.superado ?? 0) === 0 && Number(vigente.elim ?? 0) === 0)) {
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
            await LightdataQuerys.update({
                dbConnection,
                table: "clientes",
                did: Number(clienteId),
                quien: userId,
                data: { superado: 1 },
            });

            // insertar nueva versión con MISMO did
            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes",
                quien: userId,
                data: {
                    did: Number(clienteId),
                    nombre_fantasia,
                    razon_social,
                    codigo,
                    observaciones,
                    habilitado,
                    superado: 0,
                    elim: 0,
                },
            });

            changed.cliente = 1;
        }

        // 3) Direcciones
        // add
        for (const d of dAdd) {
            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes_direcciones",
                quien: userId,
                data: {
                    did_cliente: Number(clienteId),
                    address_line: d?.address_line ?? null,
                    pais: d?.pais ?? null,
                    localidad: d?.localidad ?? null,
                    numero: d?.numero ?? null,
                    calle: d?.calle ?? null,
                    cp: d?.cp ?? null,
                    provincia: d?.provincia ?? null,
                    titulo: d?.titulo ?? null,
                    superado: 0,
                    elim: 0,
                },
            });
            changed.direcciones.added++;
        }

        // update (versionado por did)
        for (const d of dUpd) {
            if (!d?.did) continue;

            const [cur] = await LightdataQuerys.select({
                dbConnection,
                table: "clientes_direcciones",
                column: "did",
                value: d.did,
            });
            if (
                !cur ||
                Number(cur.did_cliente) !== Number(clienteId) ||
                Number(cur.superado ?? 0) !== 0 ||
                Number(cur.elim ?? 0) !== 0
            ) {
                continue;
            }

            const address_line = d?.address_line ?? cur.address_line ?? null;
            const pais = d?.pais ?? cur.pais ?? null;
            const localidad = d?.localidad ?? cur.localidad ?? null;
            const numero = d?.numero ?? cur.numero ?? null;
            const calle = d?.calle ?? cur.calle ?? null;
            const cp = d?.cp ?? cur.cp ?? null;
            const provincia = d?.provincia ?? cur.provincia ?? null;
            const titulo = d?.titulo ?? cur.titulo ?? null;

            await LightdataQuerys.update({
                dbConnection,
                table: "clientes_direcciones",
                did: Number(d.did),
                quien: userId,
                data: { superado: 1 },
            });

            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes_direcciones",
                quien: userId,
                data: {
                    did: Number(d.did),
                    did_cliente: Number(clienteId),
                    address_line,
                    pais,
                    localidad,
                    numero,
                    calle,
                    cp,
                    provincia,
                    titulo,
                    superado: 0,
                    elim: 0,
                },
            });

            changed.direcciones.updated++;
        }

        // remove (versionado: supera e inserta nueva versión con elim=1)
        for (const did of normalizeRemoveList(dDel)) {
            const [cur] = await LightdataQuerys.select({
                dbConnection,
                table: "clientes_direcciones",
                column: "did",
                value: did,
            });
            if (
                !cur ||
                Number(cur.did_cliente) !== Number(clienteId) ||
                Number(cur.superado ?? 0) !== 0 ||
                Number(cur.elim ?? 0) !== 0
            ) {
                continue;
            }

            await LightdataQuerys.update({
                dbConnection,
                table: "clientes_direcciones",
                did: Number(did),
                quien: userId,
                data: { superado: 1 },
            });

            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes_direcciones",
                quien: userId,
                data: {
                    did: Number(did),
                    did_cliente: Number(clienteId),
                    address_line: cur.address_line ?? null,
                    pais: cur.pais ?? null,
                    localidad: cur.localidad ?? null,
                    numero: cur.numero ?? null,
                    calle: cur.calle ?? null,
                    cp: cur.cp ?? null,
                    provincia: cur.provincia ?? null,
                    titulo: cur.titulo ?? null,
                    superado: 0,
                    elim: 1,
                },
            });

            changed.direcciones.removed++;
        }

        // 4) Contactos
        // add
        for (const c of cAdd) {
            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes_contactos",
                quien: userId,
                data: {
                    did_cliente: Number(clienteId),
                    tipo: Number(c?.tipo ?? 0),
                    valor: c?.valor ?? null,
                    superado: 0,
                    elim: 0,
                },
            });
            changed.contactos.added++;
        }

        // update
        for (const c of cUpd) {
            if (!c?.did) continue;

            const [cur] = await LightdataQuerys.select({
                dbConnection,
                table: "clientes_contactos",
                column: "did",
                value: c.did,
            });
            if (
                !cur ||
                Number(cur.did_cliente) !== Number(clienteId) ||
                Number(cur.superado ?? 0) !== 0 ||
                Number(cur.elim ?? 0) !== 0
            ) {
                continue;
            }

            const tipo = Number(c?.tipo ?? cur.tipo ?? 0);
            const valor = c?.valor ?? cur.valor ?? null;

            await LightdataQuerys.update({
                dbConnection,
                table: "clientes_contactos",
                did: Number(c.did),
                quien: userId,
                data: { superado: 1 },
            });

            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes_contactos",
                quien: userId,
                data: {
                    did: Number(c.did),
                    did_cliente: Number(clienteId),
                    tipo,
                    valor,
                    superado: 0,
                    elim: 0,
                },
            });

            changed.contactos.updated++;
        }

        // remove (versionado)
        for (const did of normalizeRemoveList(cDel)) {
            const [cur] = await LightdataQuerys.select({
                dbConnection,
                table: "clientes_contactos",
                column: "did",
                value: did,
            });
            if (
                !cur ||
                Number(cur.did_cliente) !== Number(clienteId) ||
                Number(cur.superado ?? 0) !== 0 ||
                Number(cur.elim ?? 0) !== 0
            ) {
                continue;
            }

            await LightdataQuerys.update({
                dbConnection,
                table: "clientes_contactos",
                did: Number(did),
                quien: userId,
                data: { superado: 1 },
            });

            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes_contactos",
                quien: userId,
                data: {
                    did: Number(did),
                    did_cliente: Number(clienteId),
                    tipo: Number(cur.tipo ?? 0),
                    valor: cur.valor ?? null,
                    superado: 0,
                    elim: 1,
                },
            });

            changed.contactos.removed++;
        }

        // 5) Cuentas
        // add
        for (const a of aAdd) {
            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes_cuentas",
                quien: userId,
                data: {
                    did_cliente: Number(clienteId),
                    flex: Number(a?.flex ?? 0),
                    titulo: a?.titulo ?? null,
                    ml_id_vendedor: String(a?.ml_id_vendedor ?? ""),
                    ml_user: a?.ml_user ?? null,
                    data: a?.data ?? null,
                    superado: 0,
                    elim: 0,
                },
            });
            changed.cuentas.added++;
        }

        // update
        for (const a of aUpd) {
            if (!a?.did) continue;

            const [cur] = await LightdataQuerys.select({
                dbConnection,
                table: "clientes_cuentas",
                column: "did",
                value: a.did,
            });
            if (
                !cur ||
                Number(cur.did_cliente) !== Number(clienteId) ||
                Number(cur.superado ?? 0) !== 0 ||
                Number(cur.elim ?? 0) !== 0
            ) {
                continue;
            }

            const flex = Number(a?.flex ?? cur.flex ?? 0);
            const titulo = a?.titulo ?? cur.titulo ?? null;
            const ml_id_vendedor = String(a?.ml_id_vendedor ?? cur.ml_id_vendedor ?? "");
            const ml_user = a?.ml_user ?? cur.ml_user ?? null;
            const data = a?.data ?? cur.data ?? null;

            await LightdataQuerys.update({
                dbConnection,
                table: "clientes_cuentas",
                did: Number(a.did),
                quien: userId,
                data: { superado: 1 },
            });

            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes_cuentas",
                quien: userId,
                data: {
                    did: Number(a.did),
                    did_cliente: Number(clienteId),
                    flex,
                    titulo,
                    ml_id_vendedor,
                    ml_user,
                    data,
                    superado: 0,
                    elim: 0,
                },
            });

            changed.cuentas.updated++;
        }

        // remove (versionado)
        for (const did of normalizeRemoveList(aDel)) {
            const [cur] = await LightdataQuerys.select({
                dbConnection,
                table: "clientes_cuentas",
                column: "did",
                value: did,
            });
            if (
                !cur ||
                Number(cur.did_cliente) !== Number(clienteId) ||
                Number(cur.superado ?? 0) !== 0 ||
                Number(cur.elim ?? 0) !== 0
            ) {
                continue;
            }

            await LightdataQuerys.update({
                dbConnection,
                table: "clientes_cuentas",
                did: Number(did),
                quien: userId,
                data: { superado: 1 },
            });

            await LightdataQuerys.insert({
                dbConnection,
                table: "clientes_cuentas",
                quien: userId,
                data: {
                    did: Number(did),
                    did_cliente: Number(clienteId),
                    flex: Number(cur.flex ?? 0),
                    titulo: cur.titulo ?? null,
                    ml_id_vendedor: String(cur.ml_id_vendedor ?? ""),
                    ml_user: cur.ml_user ?? null,
                    data: cur.data ?? null,
                    superado: 0,
                    elim: 1,
                },
            });

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
