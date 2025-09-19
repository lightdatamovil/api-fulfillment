import { CustomException, executeQuery } from "lightdata-tools";

export async function getAtributoById(dbConnection, req) {
    const { atributoId } = req.params;

    const selectQuery = `
    SELECT 
      a.did               AS atributo_id,
      a.nombre            AS atributo_nombre,
      a.codigo            AS atributo_codigo,
      a.descripcion       AS atributo_descripcion,
      a.habilitado        AS atributo_habilitado,
      av.did              AS valor_id,
      av.codigo           AS valor_codigo,
      av.valor            AS valor_nombre
    FROM atributos a
    LEFT JOIN atributos_valores av
      ON av.didAtributo = a.did
     AND av.elim = 0
     AND av.superado = 0
    WHERE a.elim = 0
      AND a.superado = 0
      AND a.did = ?
    ORDER BY av.did ASC
  `;

    const rows = await executeQuery(dbConnection, selectQuery, [atributoId]);

    if (!rows || rows.length === 0) {
        throw new CustomException({
            title: "Atributo no encontrado",
            message: `No se encontró un atributo activo con el ID ${atributoId}`,
        });
    }

    // Armamos el objeto del atributo con sus valores
    const first = rows[0];
    const atributo = {
        did: first.atributo_id,
        nombre: first.atributo_nombre,
        codigo: first.atributo_codigo,
        descripcion: first.atributo_descripcion,
        habilitado: first.atributo_habilitado,
        valores: []
    };

    for (const r of rows) {
        if (r.valor_id) {
            atributo.valores.push({
                did: r.valor_id,
                codigo: r.valor_codigo,
                valor: r.valor_nombre
            });
        }
    }

    return {
        success: true,
        message: "Atributo obtenido correctamente",
        data: atributo,
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
}
