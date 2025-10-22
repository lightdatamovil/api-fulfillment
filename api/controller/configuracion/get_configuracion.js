import { LightdataORM } from "lightdata-tools";

// src/endpoints/empresas/get_modo_trabajo.js
export async function getModoTrabajo(connection) {

    const [row] = await LightdataORM.select({
        dbConnection: connection,
        table: "sistema_empresa",
        //! SACAR ESTO CON LA VERSION 1.4.70 DE LIGHTDATA TOOLS
        where: { elim: 0 },
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
        data: { modo_trabajo: row.modo_trabajo }, // si preferís camelCase, dejá solo modoTrabajo
    };
}
