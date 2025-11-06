import { CustomException, LightdataORM, Status } from "lightdata-tools";

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
export async function getProductoById({ db, req }) {
  const didParam = req.params?.did ?? req.params?.id ?? req.params?.productoId;
  const didProducto = Number(didParam);

  if (!Number.isFinite(didProducto) || didProducto <= 0) {
    throw new CustomException({
      title: "Parámetro inválido",
      message: "El parámetro 'did' debe ser numérico y mayor que 0",
      status: Status.badRequest,
    });
  }

  const [p] = await LightdataORM.select({
    db,
    table: "productos",
    where: { did: didProducto },
    throwIfNotExists: true,
    log: true,
  });

  const [vvRows, ecRows, insRows, comboRows] = await Promise.all([
    // COMBINACIONES de variantes (CSV en 'valores')
    LightdataORM.select({
      db,
      table: "productos_variantes_valores",
      where: { did_producto: didProducto },
    }),
    // Items ecommerce (grupos)
    LightdataORM.select({
      db,
      table: "productos_ecommerce",
      where: { did_producto: didProducto },
    }),
    // Insumos
    LightdataORM.select({
      db,
      table: "productos_insumos",
      where: { did_producto: didProducto },
    }),
    // Combos
    LightdataORM.select({
      db,
      table: "productos_combos",
      where: { did_producto: didProducto },
    }),
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
    did: Number(r.did),
    did_producto_variante_valor: Number(r.did_producto_variante_valor), // dato opcional
    didCuenta: Number(r.did_cuenta),
    sku: r.sku ?? "",
    ean: r.ean ?? "",
    url: r.url ?? "",
    sync: Number(r.sync),
  }));

  // 3) ECOMMERCE: un bloque por agrupación, filtrando por DID
  const ecommerce = agrupaciones.map(c => ({
    //agregar did
    did: c.did,
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

  let files = [];
  if (p.imagen) {
    files.push(
      p.imagen
    );
  }

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
    files,
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
