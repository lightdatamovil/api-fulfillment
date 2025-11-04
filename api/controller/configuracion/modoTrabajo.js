import { CustomException, LightdataORM } from "lightdata-tools";

export async function toggleModoTrabajo({ db, req }) {
    const { modo_trabajo } = req.body;
    const { companyId, userId } = req.user;

    const [modoActual] = await LightdataORM.select({
        db,
        table: "sistema_empresa",
        where: { did: companyId },
        select: ["modo_trabajo"],
    });

    if (modoActual.modo_trabajo == modo_trabajo) {
        throw new CustomException({
            title: "Modo de trabajo inválido",
            message: `El modo de trabajo ya está en ${modo_trabajo}`,
        });
    }

    await LightdataORM.update({
        db,
        table: "sistema_empresa",
        where: { did: companyId },
        quien: userId,
        data: { modo_trabajo: modo_trabajo },
    });

    return {
        success: true,
        message: "Modo de trabajo cambiado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
