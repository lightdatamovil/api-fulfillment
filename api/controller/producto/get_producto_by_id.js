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
    // COMBINACIONES de variantes (CSV en 'valores')
    executeQuery(
      dbConnection,
      `
        SELECT did, valores
        FROM productos_variantes_valores
        WHERE did_producto = ? AND elim = 0 AND superado = 0
        ORDER BY id ASC
      `,
      [didProducto]
    ),
    // Items ecommerce (grupos)
    executeQuery(
      dbConnection,
      `
        SELECT did, did_cuenta, did_producto_variante_valor, sku, ean, url, sync
        FROM productos_ecommerce
        WHERE did_producto = ? AND elim = 0 AND superado = 0
      `,
      [didProducto]
    ),
    // Insumos
    executeQuery(
      dbConnection,
      `
        SELECT did, did_insumo, cantidad
        FROM productos_insumos
        WHERE did_producto = ? AND elim = 0 AND superado = 0
      `,
      [didProducto]
    ),
    // Combos
    executeQuery(
      dbConnection,
      `
        SELECT did, did_producto_combo AS did_producto, cantidad
        FROM productos_combos
        WHERE did_producto = ? AND elim = 0 AND superado = 0
      `,
      [didProducto]
    ),
  ]);


  // helper para parsear CSV -> number[]
  const parseCSVToNums = (csv) =>
    String(csv || "")
      .split(",")
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

  // 1) AGRUPACIONES (desde productos_variantes_valores)
  const agrupaciones = (vvRows ?? []).map(r => ({
    did: Number(r.did),                         // DID de la agrupación
    variantes_valores: parseCSVToNums(r.valores) // array de números
  }));

  const grupos = (ecRows ?? []).map(r => ({       // PARA AGRUPAR
    did_producto_variante_valor: Number(r.did_producto_variante_valor), // dato opcional
    didCuenta: Number(r.did_cuenta),
    sku: r.sku ?? "",
    ean: r.ean ?? "",
    url: r.url ?? "",
    sync: Number(r.sync),
  }));

  // 3) ECOMMERCE: un bloque por agrupación, filtrando por DID
  const ecommerce = agrupaciones.map(c => ({
    variantes_valores: c.variantes_valores,
    grupos: grupos.filter(g => g.did_producto_variante_valor === c.did),
  }));

  //sacar de grupos el campo did_producto_variante_valor ya que no es parte del response
  for (const g of grupos) {
    delete g.did_producto_variante_valor;
  }


  // 6) Insumos & Combos
  const insumos = (insRows ?? []).map((r) => ({
    did: Number(r.did),
    didInsumo: Number(r.did_insumo),
    cantidad: Number(r.cantidad),
  }));

  const combos = (comboRows ?? []).map((r) => ({
    did: Number(r.did),
    didProducto: Number(r.did_producto),
    cantidad: Number(r.cantidad),
  }));

  // 7) Payload final
  const data = {
    did_cliente: Number(p.did_cliente),
    titulo: p.titulo ?? "",
    descripcion: p.descripcion ?? "",
    habilitado: p.habilitado,
    es_combo: Number(p.es_combo),
    posicion: p.posicion,
    cm3: p.cm3 != null ? Number(p.cm3) : 0,
    alto: p.alto != null ? String(p.alto) : "",
    ancho: p.ancho != null ? String(p.ancho) : "",
    profundo: p.profundo != null ? String(p.profundo) : "",
    files: [p.imagen],
    sku: p.sku ?? "",
    ean: p.ean ?? "",
    did_curva: p.did_curva != null ? Number(p.did_curva) : null,
    ecommerce,
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



