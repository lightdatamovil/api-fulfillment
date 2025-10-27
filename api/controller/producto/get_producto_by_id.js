import { CustomException, Status, executeQuery } from "lightdata-tools";

/**
 * GET producto por DID con esta forma exacta:
 * {
 *   did_cliente:number, titulo:string, descripcion:string, habilitado:boolean, es_combo:boolean,
 *   posicion:number, cm3:number, alto:string, ancho:string, profundo:string, imagen:string|null,
 *   sku:string, ean:string, didCurva:number|null,
 *   ecommerce:[{ did:number, didCuenta:number, sku:string, ean:string, url:string, sync:boolean, variantes_valores:number[] }],
 *   insumos:[{ did:number, didInsumo:number, cantidad:number }],
 *   combos:[{ did:number, didProducto:number, cantidad:number }]
 * }
 */
export async function getProductoById(dbConnection, req) {
  const didParam = req.params?.did ?? req.params?.id ?? req.params?.productoId;
  const didProducto = Number(didParam);

  if (!Number.isFinite(didProducto) || didProducto <= 0) {
    throw new CustomException({
      title: "Parámetro inválido",
      message: "El parámetro 'did' debe ser numérico y mayor que 0",
      status: Status.badRequest,
    });
  }

  const prodRows = await executeQuery(
    dbConnection,
    `
      SELECT did, did_cliente, titulo, descripcion, imagen, habilitado, es_combo,
             posicion, cm3, alto, ancho, profundo, did_curva, sku, ean
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

  const [vvRows, ecRows, insRows, comboRows] = await Promise.all([
    // variantes del producto (nivel producto, se repiten en cada ecommerce según tu formato)
    executeQuery(
      dbConnection,
      `SELECT valores
         FROM productos_variantes_valores
        WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto]
    ),
    // ecommerce (necesitamos DID para edición)
    executeQuery(
      dbConnection,
      `SELECT did, did_cuenta, sku, ean, url, sync
         FROM productos_ecommerce
        WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto]
    ),
    // insumos
    executeQuery(
      dbConnection,
      `SELECT did, did_insumo, cantidad
         FROM productos_insumos
        WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto]
    ),
    // combos
    executeQuery(
      dbConnection,
      `SELECT did, did_producto_combo AS did_producto, cantidad
         FROM productos_combos
        WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto]
    ),
  ]);

  const variantesValores = (vvRows ?? [])
    .map(r => Number(r.valores))
    .filter(n => Number.isFinite(n) && n > 0);

  const grupos = (ecRows ?? []).map(r => ({
    didCuenta: Number(r.did_cuenta),
    sku: r.sku ?? "",
    ean: r.ean ?? "",
    url: r.url ?? "",
    sync: Number(r.sync) === 1 || r.sync === true,
  }));

  const ecommerce = [
    { variantesValores, grupos }
  ];
  const insumos = (insRows ?? []).map(r => ({
    did: Number(r.did),
    didInsumo: Number(r.did_insumo),
    cantidad: Number(r.cantidad),
  }));

  const combos = (comboRows ?? []).map(r => ({
    did: Number(r.did),
    didProducto: Number(r.did_producto),
    cantidad: Number(r.cantidad),
  }));

  const data = {
    did_cliente: Number(p.did_cliente),
    titulo: p.titulo ?? "",
    descripcion: p.descripcion ?? "",
    habilitado: Number(p.habilitado) === 1,
    es_combo: Number(p.es_combo) === 1,
    posicion: p.posicion != null ? Number(p.posicion) : 0,
    cm3: p.cm3 != null ? Number(p.cm3) : 0,
    alto: p.alto != null ? String(p.alto) : "",
    ancho: p.ancho != null ? String(p.ancho) : "",
    profundo: p.profundo != null ? String(p.profundo) : "",
    imagen: p.imagen ?? "",
    sku: p.sku ?? "",
    ean: p.ean ?? "",
    did_curva: p.did_curva != null ? Number(p.did_curva) : null,
    // imagen: p.imagen ?? null, // incluila si la necesitás
    ecommerce,            // <- lo armado en el paso 3
    insumos,
    combos,
  };

  return {
    success: true,
    message: "Producto obtenido correctamente",
    data,
    meta: { timestamp: new Date().toISOString() },
  };
}
