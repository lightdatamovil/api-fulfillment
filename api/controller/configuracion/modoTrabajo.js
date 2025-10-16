import { CustomException, LightdataORM } from "lightdata-tools";

export async function toggleModoTrabajo(dbConnection, req) {
    const { modoTrabajo } = req.body;
    const { companyId, userId } = req.user;



    const [modoActual] = await LightdataORM.select({
        dbConnection,
        table: "sistema_empresa",
        where: { did: companyId },
        select: ["modo_trabajo"],
    });

    if (modoActual.modo_trabajo == modoTrabajo) {
        throw new CustomException({
            title: "Modo de trabajo inválido",
            message: `El modo de trabajo ya está en ${modoTrabajo}`,
        });
    }

    await LightdataORM.update({
        dbConnection,
        table: "sistema_empresa",
        where: { did: companyId },
        quien: userId,
        data: { modo_trabajo: modoTrabajo },
    });


    return {
        success: true,
        message: "Modo de trabajo cambiado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
