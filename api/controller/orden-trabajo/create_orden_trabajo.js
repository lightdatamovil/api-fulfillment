import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Crea una Orden de Trabajo (OT) y opcionalmente:
 * - asigna pedidos a la OT (ordenes_trabajo_pedidos)
 * - registra historial por-pedido (ordenes_trabajo_pedidos_estados) **versionado**
 *
 * Body:
 *  {
 *    "estado": 1,           // int (opcional)
 *    "asignada": 0|1,       // tinyint (opcional)
 *    "fecha_inicio": "YYYY-MM-DD HH:mm:ss", // opcional
 *    "fecha_fin":    "YYYY-MM-DD HH:mm:ss", // opcional
 *    "pedidos": [ { "did_pedido": 123, "estado": 1, "flex": 0 } ],      // opcional
 *    "pedidosEstados": [ { "did_pedido": 123, "estado": 2, "fecha": "YYYY-MM-DD HH:mm:ss" } ] // opcional
 *  }
 */
export async function createOrdenTrabajo(db, req) {
    const { userId } = req.user ?? {};
    const body = req.body || {};

    // Defaults
    const estado = Number.isFinite(Number(body.estado)) ? Number(body.estado) : null;
    const asignada = Number.isFinite(Number(body.asignada)) ? Number(body.asignada) : 0;
    const fecha_inicio = body.fecha_inicio ?? null;
    const fecha_fin = body.fecha_fin ?? null;

    // INSERT OT (did=0 → luego se iguala a id)
    const ins = await executeQuery(
        db,
        `INSERT INTO ordenes_trabajo (did, estado, asignada, fecha_inicio, fecha_fin, quien, superado, elim)
     VALUES (0, ?, ?, ?, ?, ?, 0, 0)`,
        [estado, asignada, fecha_inicio, fecha_fin, userId ?? null],
        true
    );
    if (!ins || ins.affectedRows === 0) {
        throw new CustomException({ title: "Error", message: "No se pudo crear la Orden de Trabajo", status: Status.internalServerError });
    }

    const id = ins.insertId;
    await executeQuery(db, `UPDATE ordenes_trabajo SET did = ? WHERE id = ?`, [id, id], true);
    const did_ot = id;

    // Asignación inicial de pedidos (opcional)
    let insertedLinks = 0;
    if (Array.isArray(body.pedidos)) {
        for (const it of body.pedidos) {
            const did_pedido = Number(it?.did_pedido);
            if (!Number.isFinite(did_pedido) || did_pedido <= 0) {
                throw new CustomException({ title: "Pedido inválido", message: "Cada item en 'pedidos' requiere 'did_pedido' numérico > 0", status: Status.badRequest });
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

    // Historial inicial por-pedido (opcional) — **versionado** (superar + insertar)
    let insertedEvents = 0;
    if (Array.isArray(body.pedidosEstados)) {
        for (const ev of body.pedidosEstados) {
            const did_pedido = Number(ev?.did_pedido);
            if (!Number.isFinite(did_pedido) || did_pedido <= 0) {
                throw new CustomException({ title: "Evento inválido", message: "Cada item en 'pedidosEstados' requiere 'did_pedido' numérico > 0", status: Status.badRequest });
            }
            const estadoEv = Number.isFinite(Number(ev?.estado)) ? Number(ev.estado) : null;
            const fecha = ev?.fecha ?? new Date();

            // 1) Superar vigente anterior (si existiera) para ese (OT, pedido)
            await executeQuery(
                db,
                `UPDATE ordenes_trabajo_pedidos_estados
           SET superado = 1
         WHERE did_orden_trabajo = ? AND did_pedido = ? AND elim = 0 AND superado = 0`,
                [did_ot, did_pedido],
                true
            );

            // 2) Insertar nuevo evento como vigente
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
        message: "Orden de Trabajo creada correctamente",
        data: { did: did_ot, pedidos_asignados: insertedLinks, eventos: insertedEvents },
        meta: { timestamp: new Date().toISOString() },
    };
}
