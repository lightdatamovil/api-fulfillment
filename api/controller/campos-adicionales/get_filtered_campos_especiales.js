// generame el codigo 

import { executeQuery } from "lightdata-tools";

export async function getFilteredCamposEspeciales({ db, req }) {
    const { filtro } = req.query;
    let query = `
        SELECT nombre, config, did
        FROM identificadores_especiales
        WHERE elim = 0
          AND superado = 0
    `;
    if (filtro) {
        query += ` AND nombre LIKE '%${filtro}%'`;
    }
    const rows = await executeQuery({ db, query });
    return rows;
}
