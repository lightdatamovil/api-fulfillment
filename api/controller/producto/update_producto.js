import { CustomException, Status, isNonEmpty, isDefined, number01, LightdataORM } from "lightdata-tools";

export async function updateProducto(dbConnection, req) {
  const {
    did,
    did_cliente,
    titulo,
    descripcion,
    imagen,
    habilitado,
    es_combo,
    posicion,
    cm3,
    alto,
    ancho,
    profundo,
    depositos,
    insumos,
    variantesValores,
    ecommerce,
    combo,
  } = req.body;

  const quien = Number(req.user.userId);
  const didProducto = Number(did);

  if (!Number.isFinite(didProducto) || didProducto <= 0) {
    throw new CustomException({
      title: "Parámetro inválido",
      message: "Se requiere 'did' numérico válido",
      status: Status.badRequest,
    });
  }

  const currRows = await LightdataORM.select({
    dbConnection,
    table: "productos",
    where: { did: didProducto },
    throwIfNotExists: true,
  });
  const curr = currRows[0];

  const newData = {
    did_cliente: isDefined(did_cliente) ? Number(did_cliente) : curr.did_cliente,
    titulo: isNonEmpty(titulo) ? String(titulo).trim() : curr.titulo,
    descripcion: isNonEmpty(descripcion) ? String(descripcion).trim() : curr.descripcion,
    imagen: isNonEmpty(imagen) ? String(imagen).trim() : curr.imagen,
    habilitado: isDefined(habilitado) ? number01(habilitado) : curr.habilitado,
    es_combo: isDefined(es_combo) ? number01(es_combo) : curr.es_combo,
    posicion: isDefined(posicion) ? Number(posicion) : curr.posicion ?? 0,
    cm3: isDefined(cm3) ? Number(cm3) : curr.cm3 ?? 0,
    alto: isDefined(alto) ? Number(alto) : curr.alto ?? 0,
    ancho: isDefined(ancho) ? Number(ancho) : curr.ancho ?? 0,
    profundo: isDefined(profundo) ? Number(profundo) : curr.profundo ?? 0,
  };

  const newIds = await LightdataORM.update({
    dbConnection,
    table: "productos",
    where: { did: didProducto },
    data: newData,
    quien,
  });

  const newId = newIds[0];
  const newEsCombo = newData.es_combo;

  if (Array.isArray(depositos)) {
    await LightdataORM.delete({
      dbConnection,
      table: "productos_depositos",
      where: { did_producto: didProducto },
      quien,
    });

    const data = depositos.map(d => ({
      did_producto: didProducto,
      did_deposito: Number(d),
    }));

    await LightdataORM.insert({ dbConnection, table: "productos_depositos", data, quien });
  }

  if (Array.isArray(insumos)) {
    await LightdataORM.delete({
      dbConnection,
      table: "productos_insumos",
      where: { did_producto: didProducto },
      quien,
    });

    const data = insumos.map((it) => ({
      did_producto: didProducto,
      did_insumo: Number(it.did_insumo),
      habilitado: isDefined(it.habilitado) ? number01(it.habilitado) : 1,
    }));

    await LightdataORM.insert({ dbConnection, table: "productos_insumos", data, quien });
  }

  if (Array.isArray(variantesValores)) {
    await LightdataORM.delete({
      dbConnection,
      table: "productos_variantes_valores",
      where: { did_producto: didProducto },
      quien,
    });

    const data = variantesValores.map(v => ({
      did_producto: didProducto,
      did_variante_valor: Number(v),
    }));

    await LightdataORM.insert({ dbConnection, table: "productos_variantes_valores", data, quien });
  }

  if (Array.isArray(ecommerce)) {
    await LightdataORM.delete({
      dbConnection,
      table: "productos_ecommerce",
      where: { did_producto: didProducto },
      quien,
    });

    const data = ecommerce.map(e => ({
      did_producto: didProducto,
      did_cuenta: Number(e.did_cuenta),
      did_producto_valor: isDefined(e.did_producto_valor) ? Number(e.did_producto_valor) : null,
      sku: isNonEmpty(e.sku) ? String(e.sku).trim() : null,
      ean: isNonEmpty(e.ean) ? String(e.ean).trim() : null,
      url: isNonEmpty(e.url) ? String(e.url).trim() : null,
      sync: isDefined(e.actualizar_sync) ? number01(e.actualizar_sync) : 0,
    }));

    await LightdataORM.insert({ dbConnection, table: "productos_ecommerce", data, quien });
  }

  if (newEsCombo === 0) {
    await LightdataORM.delete({
      dbConnection,
      table: "productos_combos",
      where: { did_producto: didProducto },
      quien,
    });
  } else if (newEsCombo === 1 && Array.isArray(combo)) {
    const hijos = combo.map(c => Number(c.did_producto));
    const hijosRows = await LightdataORM.select({
      dbConnection,
      table: "productos",
      where: { did: hijos },
      select: "did, es_combo, elim, superado",
    });

    const mapHijos = new Map(hijosRows.map(r => [Number(r.did), r]));
    for (const it of combo) {
      const didHijo = Number(it.did_producto);
      const cant = Number(it.cantidad);

      const row = mapHijos.get(didHijo);
      if (!row || row.elim || row.superado)
        throw new CustomException({ title: "Producto hijo no válido", message: `El hijo ${didHijo} no está vigente.`, status: Status.badRequest });
      if (Number(row.es_combo) === 1)
        throw new CustomException({ title: "Combo anidado no permitido", message: `El hijo ${didHijo} es un combo.`, status: Status.badRequest });
      if (didHijo === didProducto)
        throw new CustomException({ title: "Referencia inválida", message: "Un combo no puede referenciarse a sí mismo.", status: Status.badRequest });
      if (!Number.isFinite(cant) || cant <= 0)
        throw new CustomException({ title: "Cantidad inválida", message: "La cantidad debe ser > 0.", status: Status.badRequest });
    }

    await LightdataORM.delete({
      dbConnection,
      table: "productos_combos",
      where: { did_producto: didProducto },
      quien,
    });

    const data = combo.map(it => ({
      did_producto: didProducto,
      did_producto_combo: Number(it.did_producto),
      cantidad: Number(it.cantidad),
    }));

    await LightdataORM.insert({ dbConnection, table: "productos_combos", data, quien });
  }

  return {
    success: true,
    message: "Producto versionado correctamente (ORM)",
    data: {
      did: didProducto,
      idVersionNueva: newId,
      titulo: newData.titulo,
      es_combo: newEsCombo,
    },
    meta: { timestamp: new Date().toISOString() },
  };
}
