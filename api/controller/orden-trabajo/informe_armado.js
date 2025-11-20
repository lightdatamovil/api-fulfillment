import { executeQuery } from "lightdata-tools";

export async function informeArmado({ db, req }) {
    const { fecha_from, fecha_to } = req.query;
    const query = `
  SELECT 
    (SELECT COUNT(*) FROM ordenes_trabajo WHERE estado = 3) AS armadas,
    (SELECT COUNT(*) FROM ordenes_trabajo WHERE estado = 4) AS desestimadas;

   `;
    const results = await executeQuery({ db, query, values: [fecha_from, fecha_to] });
    return results;
}