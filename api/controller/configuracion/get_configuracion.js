import { LightdataORM } from "lightdata-tools";

export async function getModoTrabajo({ db }) {

    const [row] = await LightdataORM.select({
        db,
        table: "sistema_empresa",
        select: ["modo_trabajo"],
    });

    if (!row) {
        return {
            success: false,
            message: "No se encontró el modo de trabajo",
            data: null,
        };
    }

    return {
        success: true,
        message: "Modo de trabajo obtenido correctamente",
        data: { modo_trabajo: row.modo_trabajo },
    };
}
