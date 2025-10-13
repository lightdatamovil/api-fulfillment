import { CustomException, executeQuery, Status, isDefined, LightdataORM } from "lightdata-tools";

export async function updateOrdenTrabajo(db, req) {
    const { userId } = req.user;
    const body = req.body;
    const did_ot = req.params.did;

    const [prev] = await LightdataORM.select({
        dbConnection: db,
        table: "ordenes_trabajo",
        throwIfNotExists: true,
        where: { did: did_ot },
    });

    await LightdataORM.update({
        dbConnection: db,
        table: "ordenes_trabajo",
        data: {
            estado: isDefined(body.estado) ? Number(body.estado) : prev.estado ?? null,
            asignada: isDefined(body.asignada) ? Number(body.asignada) : prev.asignada ?? 0,
            fecha_inicio: isDefined(body.fecha_inicio) ? body.fecha_inicio : prev.fecha_inicio ?? null,
            fecha_fin: isDefined(body.fecha_fin) ? body.fecha_fin : prev.fecha_fin ?? null,
            quien: userId
        },
        where: { did: did_ot },
    });

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

            await executeQuery(
                db,
                `INSERT INTO ordenes_trabajo_pedidos
           (did_orden_trabajo, did_pedido, flex, estado, quien, superado, elim)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
                [did_ot, did_pedido, flex, estadoPed, userId ?? null],
                true
            );
        }
    }

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

            await executeQuery(
                db,
                `UPDATE ordenes_trabajo_pedidos_estados
           SET superado = 1
         WHERE did_orden_trabajo = ? AND did_pedido = ? AND elim = 0 AND superado = 0`,
                [did_ot, did_pedido],
                true
            );

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
            }
        }
    }

    return {
        success: true,
        message: "Orden de Trabajo versionada correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
