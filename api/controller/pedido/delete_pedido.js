import { LightdataORM } from "lightdata-tools";

export async function deletePedido({ db, req }) {
    const didParam = req.body?.did ?? req.params?.did;
    const { userId } = req.user;
    const did = Number(didParam);

    await LightdataORM.delete({
        db,
        table: "pedidos",
        where: { did_pedido: did },
        quien: userId,
        throwIfNotFound: true
    })

    await LightdataORM.delete({
        db,
        table: "pedidos_productos",
        where: { did_pedido: did },
        quien: userId,
    })

    await LightdataORM.delete({
        db,
        table: "pedidos",
        where: { did },
        quien: userId,
    })

    // Si quisieras eliminar historial:
    // const updHist = await executeQuery(
    //   db,
    //   `UPDATE pedidos_historial SET elim = 1 WHERE did_pedido = ? AND elim = 0`,
    //   [did],
    //   true
    // );

    return {
        success: true,
        message: "Pedido eliminado correctamente",
        data: { did },
        meta: { timestamp: new Date().toISOString() },
    };
}
