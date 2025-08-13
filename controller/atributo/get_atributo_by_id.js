import { executeQuery } from "lightdata-tools";

export async function getAtributoById(dbConnection, req) {
    const { atributoId } = req.params;
    const selectQuery = `
      SELECT 
        a.id,
        a.did AS atributo_id,
        a.nombre,
        a.codigo AS atributo_codigo,
        a.descripcion,
        av.did AS valor_id,
        av.codigo AS valor_codigo,
        av.valor AS valor_nombre,
        a.habilitado
      FROM atributos a
      LEFT JOIN atributos_valores av ON av.didAtributo = a.did AND av.elim = 0 and av.superado = 0
      WHERE a.elim = 0 AND a.superado = 0 and a.did = ? 
      ORDER BY a.did DESC
    `;

    const results = await executeQuery(dbConnection, selectQuery, [atributoId]);

    // Agrupar por atributo
    const atributosMap = new Map();

    for (const row of results) {
        if (!atributosMap.has(row.atributo_id)) {
            atributosMap.set(row.atributo_id, {
                nombre: row.nombre,
                codigo: row.atributo_codigo,
                did: row.atributo_id,
                descripcion: row.descripcion,
                habilitado: row.habilitado,
                valores: [],
            });
        }

        if (row.valor_id) {
            atributosMap.get(row.atributo_id).valores.push({
                did: row.valor_id,
                codigo: row.valor_codigo,
                valor: row.valor_nombre,
            });
        }
    }

    return Array.from(atributosMap.values());

}