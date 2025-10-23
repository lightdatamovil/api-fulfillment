import { CustomException, Status, executeQuery } from "lightdata-tools";

/**
 * Detalle de producto por DID (vigente) + asociaciones vigentes.
 * Devuelve:
 *  - producto
 *  - depositos: number[]
 *  - insumos: [{ did_insumo, cantidad, habilitado }]
 *  - variantesValores: number[]
 *  - ecommerce: [{ did_cuenta, sku, ean, url, sync }]
 *  - combo (si es_combo=1): [{ did_producto, cantidad, titulo }]
 */
export async function getProductoById(dbConnection, req) {
  // 🔎 Param DID
  const didParam = req.params?.did ?? req.params?.id ?? req.params?.productoId;
  const didProducto = Number(didParam);

  if (!Number.isFinite(didProducto) || didProducto <= 0) {
    throw new CustomException({
      title: "Parámetro inválido",
      message: "El parámetro 'did' debe ser numérico y mayor que 0",
      status: Status.badRequest,
    });
  }

  // 🧩 Producto principal (vigente)
  const prodRows = await executeQuery(
    dbConnection,
    `
      SELECT did, did_cliente, titulo, descripcion, imagen, habilitado, es_combo,
             posicion, cm3, alto, ancho, profundo, sku, ean
      FROM productos
      WHERE did = ? AND elim = 0 AND superado = 0
      ORDER BY id DESC
      LIMIT 1
    `,
    [didProducto]
  );

  if (!prodRows?.length) {
    throw new CustomException({
      title: "No encontrado",
      message: `No se encontró un producto vigente con DID ${didProducto}`,
      status: Status.notFound,
    });
  }

  const p = prodRows[0];

  // 🧩 Asociaciones vigentes en paralelo
  const [
    depRows,
    insRows,
    vvRows,
    ecRows,
    comboRows,
  ] = await Promise.all([
    executeQuery(
      dbConnection,
      `SELECT did_deposito
         FROM productos_depositos
        WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto]
    ),
    executeQuery(
      dbConnection,
      `SELECT did_insumo, cantidad, habilitado
         FROM productos_insumos
        WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto]
    ),
    executeQuery(
      dbConnection,
      `SELECT did_variante_valor
         FROM productos_variantes_valores
        WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto]
    ),
    executeQuery(
      dbConnection,
      `SELECT did_cuenta, sku, ean, url, sync
         FROM productos_ecommerce
        WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto]
    ),
    executeQuery(
      dbConnection,
      `SELECT pc.did_producto_combo AS did_producto, pc.cantidad
         FROM productos_combos pc
        WHERE pc.did_producto = ? AND pc.elim = 0 AND pc.superado = 0`,
      [didProducto]
    ),
  ]);

  // 🧩 Enriquecer combos con títulos de productos hijos (vigentes)
  let combo = [];
  if (Number(p.es_combo) === 1 && comboRows?.length) {
    const hijosDid = comboRows.map(r => Number(r.did_producto)).filter(Boolean);
    let hijosMap = new Map();

    if (hijosDid.length) {
      const hijosRows = await executeQuery(
        dbConnection,
        `
          SELECT did, titulo
            FROM productos
           WHERE did IN (${hijosDid.map(() => "?").join(",")})
             AND elim = 0 AND superado = 0
           ORDER BY id DESC
        `,
        hijosDid
      );
      hijosMap = new Map(hijosRows.map(h => [Number(h.did), h.titulo]));
    }

    combo = comboRows.map(r => ({
      did_producto: Number(r.did_producto),
      cantidad: Number(r.cantidad),
      titulo: hijosMap.get(Number(r.did_producto)) ?? null,
    }));
  }

  // 🧩 Armar respuesta tipada
  const data = {
    producto: {
      did: Number(p.did),
      did_cliente: Number(p.did_cliente),
      titulo: p.titulo ?? null,
      descripcion: p.descripcion ?? null,
      imagen: p.imagen ?? null,
      habilitado: Number(p.habilitado ?? 0),
      es_combo: Number(p.es_combo ?? 0),
      posicion: p.posicion != null ? Number(p.posicion) : null,
      cm3: p.cm3 != null ? Number(p.cm3) : null,
      alto: p.alto != null ? Number(p.alto) : null,
      ancho: p.ancho != null ? Number(p.ancho) : null,
      profundo: p.profundo != null ? Number(p.profundo) : null,

      sku: p.sku ?? null,
      ean: p.ean ?? null,
    },

    insumos: (insRows ?? []).map(r => ({
      did_insumo: Number(r.did_insumo),
      cantidad: Number(r.cantidad),
      habilitado: Number(r.habilitado ?? 0),
    })),

    ecommerce: (ecRows ?? []).map(r => ({
      did_cuenta: Number(r.did_cuenta),
      sku: r.sku ?? null,
      ean: r.ean ?? null,
      url: r.url ?? null,
      sync: Number(r.sync ?? 0),
    })),
    combo,
  };

  return {
    success: true,
    message: "Producto obtenido correctamente",
    data,
    meta: { timestamp: new Date().toISOString() },
  };
}
