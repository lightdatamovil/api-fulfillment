import { CustomException, executeQuery, Status, isDefined } from "lightdata-tools";

/**
 * Versionado de OT:
 * - Supera la OT vigente (superado=1) y crea una nueva versión con el mismo DID (merge prev + body).
 * - Si viene "pedidos": resync de ordenes_trabajo_pedidos (superar + insertar).
 * - Si viene "pedidosEstados": historial por-pedido **versionado** (superar + insertar).
 *
 * Body:
 *  {
 *    "did": 10,                         // por params → mapeado a body
 *    "estado": 2, "asignada": 1,        // opcional
 *    "fecha_inicio": "...", "fecha_fin": "...", // opcional
 *    "pedidos": [ { "did_pedido": 123, "estado": 1, "flex": 0 } ],      // opcional (resync)
 *    "pedidosEstados": [ { "did_pedido": 123, "estado": 2, "fecha": "..." } ] // opcional (versionado)
 *  }
 */

export async function updateOrdenTrabajo(db, req) {
    const { userId } = req.user ?? {};
    const body = req.body || {};
    const did_ot = Number(body.did ?? req.params?.did);

    if (!Number.isFinite(did_ot) || did_ot <= 0) {
        throw new CustomException({
            title: "Parámetro inválido",
            message: "'did' debe ser numérico > 0",
            status: Status.badRequest,
        });
    }

    // 1) Traer versión vigente
    const prevRows = await executeQuery(
        db,
        `SELECT * FROM ordenes_trabajo WHERE did = ? AND elim = 0 AND superado = 0 LIMIT 1`,
        [did_ot]
    );
    if (!prevRows || prevRows.length === 0) {
        throw new CustomException({
            title: "No encontrado",
            message: `No existe OT vigente con did ${did_ot}`,
            status: Status.notFound,
        });
    }
    const prev = prevRows[0];

    // 2) Merge (si no viene en body, mantenemos valor previo)
    const next = {
        estado: isDefined(body.estado) ? Number(body.estado) : prev.estado ?? null,
        asignada: isDefined(body.asignada) ? Number(body.asignada) : prev.asignada ?? 0,
        fecha_inicio: isDefined(body.fecha_inicio) ? body.fecha_inicio : prev.fecha_inicio ?? null,
        fecha_fin: isDefined(body.fecha_fin) ? body.fecha_fin : prev.fecha_fin ?? null,
    };

    // 3) Superar vigente
    await executeQuery(
        db,
        `UPDATE ordenes_trabajo SET superado = 1 WHERE did = ? AND elim = 0 AND superado = 0`,
        [did_ot],
        true
    );

    // 4) Insertar nueva versión (mismo DID)
    const ins = await executeQuery(
        db,
        `INSERT INTO ordenes_trabajo (did, estado, asignada, fecha_inicio, fecha_fin, quien, superado, elim)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
        [did_ot, next.estado, next.asignada, next.fecha_inicio, next.fecha_fin, userId ?? null],
        true
    );
    if (!ins || ins.affectedRows === 0) {
        throw new CustomException({
            title: "Error",
            message: "No se pudo insertar la nueva versión de la OT",
            status: Status.internalServerError,
        });
    }

    // 5) Resincronizar pedidos (si viene "pedidos")
    let insertedLinks = 0;
    if (Array.isArray(body.pedidos)) {
        await executeQuery(
            db,
            `UPDATE ordenes_trabajo_pedidos
         SET superado = 1
       WHERE did_orden_trabajo = ? AND elim = 0 AND superado = 0`,
            [did_ot],
            true
        );

        for (const it of body.pedidos) {
            const did_pedido = Number(it?.did_pedido);
            if (!Number.isFinite(did_pedido) || did_pedido <= 0) {
                throw new CustomException({
                    title: "Pedido inválido",
                    message: "Cada item en 'pedidos' requiere 'did_pedido' numérico > 0",
                    status: Status.badRequest,
                });
            }
            const estadoPed = Number.isFinite(Number(it?.estado)) ? Number(it.estado) : null;
            const flex = Number.isFinite(Number(it?.flex)) ? Number(it.flex) : null;

            const insLink = await executeQuery(
                db,
                `INSERT INTO ordenes_trabajo_pedidos
           (did_orden_trabajo, did_pedido, flex, estado, quien, superado, elim)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
                [did_ot, did_pedido, flex, estadoPed, userId ?? null],
                true
            );
            if (insLink?.affectedRows > 0) insertedLinks++;
        }
    }

    // 6) Historial por-pedido (si viene "pedidosEstados") — **versionado**
    let insertedEvents = 0;
    if (Array.isArray(body.pedidosEstados)) {
        for (const ev of body.pedidosEstados) {
            const did_pedido = Number(ev?.did_pedido);
            if (!Number.isFinite(did_pedido) || did_pedido <= 0) {
                throw new CustomException({
                    title: "Evento inválido",
                    message: "Cada item en 'pedidosEstados' requiere 'did_pedido' numérico > 0",
                    status: Status.badRequest,
                });
            }
            const estadoEv = Number.isFinite(Number(ev?.estado)) ? Number(ev.estado) : null;
            const fecha = ev?.fecha ?? new Date();

            // 6.1) Superar vigente anterior (si existe)
            await executeQuery(
                db,
                `UPDATE ordenes_trabajo_pedidos_estados
           SET superado = 1
         WHERE did_orden_trabajo = ? AND did_pedido = ? AND elim = 0 AND superado = 0`,
                [did_ot, did_pedido],
                true
            );

            // 6.2) Insertar evento como vigente
            const insEv = await executeQuery(
                db,
                `INSERT INTO ordenes_trabajo_pedidos_estados
           (did, did_pedido, did_orden_trabajo, estado, fecha, quien, superado, elim)
         VALUES (0, ?, ?, ?, ?, ?, 0, 0)`,
                [did_pedido, did_ot, estadoEv, fecha, userId ?? null],
                true
            );
            if (insEv?.affectedRows > 0) {
                const idEv = insEv.insertId;
                await executeQuery(
                    db,
                    `UPDATE ordenes_trabajo_pedidos_estados SET did = ? WHERE id = ?`,
                    [idEv, idEv],
                    true
                );
                insertedEvents++;
            }
        }
    }

    return {
        success: true,
        message: "Orden de Trabajo versionada correctamente",
        data: { did: did_ot, pedidos_asignados: insertedLinks, eventos: insertedEvents },
        meta: { timestamp: new Date().toISOString() },
    };
}
