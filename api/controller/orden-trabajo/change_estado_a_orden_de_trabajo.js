import { LightdataORM } from "lightdata-tools";

export async function changeEstadoAOrdenDeTrabajo({ db, req }) {
    const { userId } = req.user;
    const { estado, dids_ots } = req.body;

    //* TERMINADA
    if (estado == 3) {
        await LightdataORM.update({
            db,
            table: "pedidos",
            data: {
                armado: 1,
                quien_armado: userId
            },
            where: { did: dids_ots },
            quien: userId
        });

        // inserto como envio
    }

    //* CANCELADA
    if (estado == 4) {
        await LightdataORM.update({
            db,
            table: "pedidos",
            data: {
                trabajado: 0,
                did_ot: null
            },
            where: { did: dids_ots },
            quien: userId
        });
    }

    await LightdataORM.update({
        db,
        table: "ordenes_trabajo",
        data: {
            estado: estado
        },
        where: { did: dids_ots },
        quien: userId
    });

    return {
        message: "Estado de órdenes de trabajo actualizado correctamente",
        meta: {
            estado: estado,
            dids_ots: dids_ots,
            timestamp: new Date()
        }
    }
}
