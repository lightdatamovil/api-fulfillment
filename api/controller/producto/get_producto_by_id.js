import { CustomException, executeQuery } from "lightdata-tools";

/**
 * Detalle de producto por DID (vigente) + asociaciones vigentes.
 * Devuelve:
 *  - producto
 *  - depositos: number[]
 *  - insumos: [{ did_insumo, habilitado }]
 *  - variantesValores: number[]
 *  - ecommerce: [{ did_cuenta, did_producto_valor, sku, ean, url, actualizar_sync }]
 *  - combo (si es_combo=1): [{ did_producto, cantidad, (opcional) titulo }]
 */
export async function getProductoById(dbConnection, req) {
  const didParam = req.params?.did ?? req.params?.id ?? req.params?.productoId;
  const didProducto = Number(didParam);

  if (!Number.isFinite(didProducto) || didProducto <= 0) {
    throw new CustomException({
      title: "Parámetro inválido",
      message: "El parámetro did debe ser numérico y mayor que 0",
    });
  }

  // Producto vigente
  const prodRows = await executeQuery(
    dbConnection,
    `
      SELECT did, did_cliente, titulo, descripcion, imagen, habilitado, es_combo,
             posicion, cm3, alto, ancho, profundo
      FROM productos
      WHERE did = ? AND elim = 0 AND superado = 0
      ORDER BY id DESC
      LIMIT 1
    `,
    [didProducto]
  );

  if (!prodRows || prodRows.length === 0) {
    throw new CustomException({
      title: "No encontrado",
      message: `No se encontró un producto vigente con DID ${didProducto}`,
    });
  }
  const p = prodRows[0];

  // Asociaciones (vigentes)
  const [depRows, insRows, vvRows, ecRows, comboRows] = await Promise.all([
    executeQuery(dbConnection, `SELECT did_deposito FROM productos_depositos WHERE did_producto = ? AND elim = 0 AND superado = 0`, [didProducto]),
    executeQuery(dbConnection, `SELECT did_insumo, habilitado FROM productos_insumos WHERE did_producto = ? AND elim = 0 AND superado = 0`, [didProducto]),
    executeQuery(dbConnection, `SELECT did_variante_valor FROM productos_variantes_valores WHERE did_producto = ? AND elim = 0 AND superado = 0`, [didProducto]),
    executeQuery(dbConnection, `
      SELECT did_cuenta, did_producto_valor, sku, ean, url,sync
      FROM productos_ecommerce
      WHERE did_producto = ? AND elim = 0 AND superado = 0
    `, [didProducto]),
    executeQuery(dbConnection, `
      SELECT pc.did_producto_combo AS did_producto, pc.cantidad, pr.titulo AS producto_titulo
      FROM productos_combos pc
      LEFT JOIN productos pr ON pr.did = pc.did_producto_combo AND pr.elim = 0 AND pr.superado = 0
      WHERE pc.did_producto = ? AND pc.elim = 0 AND pc.superado = 0
    `, [didProducto])
  ]);

  const data = {
    producto: {
      did: p.did,
      did_cliente: p.did_cliente,
      titulo: p.titulo,
      descripcion: p.descripcion,
      imagen: p.imagen,
      habilitado: p.habilitado,
      es_combo: p.es_combo,
      posicion: p.posicion,
      cm3: p.cm3,
      alto: p.alto,
      ancho: p.ancho,
      profundo: p.profundo,
    },
    depositos: (depRows || []).map(r => Number(r.did_deposito)),
    insumos: (insRows || []).map(r => ({ did_insumo: Number(r.did_insumo), habilitado: Number(r.habilitado) })),
    variantesValores: (vvRows || []).map(r => Number(r.did_variante_valor)),
    ecommerce: (ecRows || []).map(r => ({
      did_cuenta: Number(r.did_cuenta),
      did_producto_valor: r.did_producto_valor != null ? Number(r.did_producto_valor) : null,
      sku: r.sku ?? null,
      ean: r.ean ?? null,
      url: r.url ?? null,
      actualizar_sync: Number(r.actualizar_sync ?? 0),
    })),
    combo: Number(p.es_combo) === 1
      ? (comboRows || []).map(r => ({
        did_producto: Number(r.did_producto),
        cantidad: Number(r.cantidad),
        titulo: r.producto_titulo || null,
      }))
      : [],
  };

  return {
    success: true,
    message: "Producto obtenido correctamente",
    data,
    meta: { timestamp: new Date().toISOString() },
  };
}
