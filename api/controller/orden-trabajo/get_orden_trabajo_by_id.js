import { executeQuery } from "lightdata-tools";

/**
 * GET OT por ID (sin filtros adicionales).
 * Acepta ot_id desde:
 *   - req.params.ot_id  | req.params.id
 *   - req.query.ot_id   | req.query.id
 *
 * Respuesta:
 * {
 *   success: true,
 *   data: {
 *     did, estado, asignado, fecha_inicio, fecha_fin, alertada,
 *     pedidos: [{ did, flex, estado, did_cliente, id_venta, productos: [...] }]
 *   }
 * }
 */
export async function getFilteredOrdenesTrabajoByDid({ db, req }) {
  const { did } = req.params || {};

  const sql = `
    SELECT 
      ot.did,
      ot.estado,
      ot.asignado,
      ot.fecha_inicio,
      ot.fecha_fin,
      ot.alertada,
      COALESCE(
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'did', p.did,
            'flex', p.flex,
            'estado', p.status,
            'did_cliente', p.did_cliente,
            'id_venta', p.number,
            'eliminado', p.elim,
            'productos', (
              SELECT COALESCE(
                JSON_ARRAYAGG(
                  JSON_OBJECT(
                    'did', pp2.did,
                    'did_producto', pp2.did_producto,
                    'descripcion', pp2.descripcion,
                    'did_producto_variante_valor',pp2.did_producto_variante_valor,
                    'codigo', pp2.codigo,
                    'ml_id', pp2.ml_id,
                    'cantidad', pp2.cantidad,
                    'variation_attributes', pp2.variation_attributes,
                    'seller_sku', pp2.seller_sku
                  )
                ),
                JSON_ARRAY()
              )
              FROM pedidos_productos AS pp2
              WHERE pp2.did_pedido = p.id AND superado=0 
            )
          )
        ),
        JSON_ARRAY()
      ) AS pedidos
    FROM ordenes_trabajo AS ot
    LEFT JOIN ordenes_trabajo_pedidos AS otp 
      ON ot.did = otp.did_orden_trabajo
    LEFT JOIN pedidos AS p
      ON otp.did_pedido = p.id
    WHERE ot.did = ?
      AND ot.superado = 0 AND ot.elim = 0
    GROUP BY ot.did
    LIMIT 1;
  `;

  const rows = await executeQuery({ db, query: sql, values: [did] });
  if (!rows?.length) {
    return { success: false, message: "OT no encontrada", data: null };
  }

  const row = rows[0];
  const data = {
    ...row,
    pedidos: typeof row.pedidos === "string" ? JSON.parse(row.pedidos) : row.pedidos,
  };

  return { success: true, message: "OK", data };
}
