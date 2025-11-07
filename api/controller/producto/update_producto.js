import { CustomException, Status, isNonEmpty, isDefined, number01, LightdataORM } from "lightdata-tools";
import { urlSubidaImagenes } from "../../db.js";
import axios from "axios";

export async function updateProducto({ db, req }) {
  const {
    did_cliente,
    titulo,
    descripcion,
    habilitado,
    posicion,
    cm3,
    alto,
    ancho,
    profundo,
    files,
    sku,
    ean,
    did_curva,
    insumos,
    combinaciones,
    productos_hijos,
  } = req.body;

  const { did } = req.params;
  const quien = Number(req.user.userId);
  const { companyId } = req.user;
  const didProducto = Number(did);
  let dataCreate = {};

  if (!Number.isFinite(didProducto) || didProducto <= 0) {
    throw new CustomException({
      title: "Parámetro inválido",
      message: "Se requiere 'did' numérico válido",
      status: Status.badRequest,
    });
  }

  const currRows = await LightdataORM.select({
    db,
    table: "productos",
    where: { did: didProducto },
    throwIfNotExists: true,
  });
  const curr = currRows[0];

  //files
  let filesInsert;
  if (files == null) {
    filesInsert = curr.files; //no hay cambios
  } else if (files.length === 0) {
    filesInsert = null; //borrar todo
  } else {
    // files es un base 64
    const urlResponse = await axios.post(
      urlSubidaImagenes,
      {
        file: files[0],
        companyId: companyId,
        clientId: did_cliente,
        productId: didProducto,
      },
      { headers: { "Content-Type": "application/json" } }
    );
    filesInsert = urlResponse.data.file.url;
  }

  //insertar producto de nuevo todo de nuevo
  const newData = {
    did_cliente,
    titulo,
    descripcion,
    habilitado,
    posicion,
    cm3,
    alto,
    ancho,
    profundo,
    imagen: filesInsert,
    sku,
    ean,
    did_curva,
  };

  await LightdataORM.update({
    db,
    table: "productos",
    where: { did: didProducto },
    data: newData,
    quien,
  });


  const hayCombinaciones = getUpdateOpsState(combinaciones);

  if (hayCombinaciones.hasRemove) {
    //preguntar a agus si vale borrar la variante
    await LightdataORM.delete({
      db,
      table: "productos_variantes_valores",
      where: { did_producto: didProducto, did: hayCombinaciones.didsRemove },
      quien: quien,
    });

    await LightdataORM.delete({
      db,
      table: "productos_ecommerce",
      where: { did_producto: didProducto, did_producto_variante_valor: hayCombinaciones.didsRemove },
      quien,
    });
  }

  if (hayCombinaciones.hasUpdate) {
    let dataUpdateCombinaciones = [];

    const didCuentaUpdate = [];

    for (const combinacion of hayCombinaciones.update) {
      for (const ecommerce of combinacion.ecommerce) {
        didCuentaUpdate.push(ecommerce.did);
        dataUpdateCombinaciones.push({
          did_producto: didProducto,
          did_cuenta: ecommerce.didCuenta,
          sku: ecommerce.sku,
          actualizar: 0,
          sync: ecommerce.sync,
        });
      }
    }

    await LightdataORM.update({
      db,
      table: "productos_ecommerce",
      where: {
        did: didCuentaUpdate
      },
      //! REVISAR
      throwIfNotExists: false,
      data: dataUpdateCombinaciones,
      quien,
    });
  }
  if (hayCombinaciones.hasAdd) {
    const setKey = (arr) =>
      Array.from(new Set((Array.isArray(arr) ? arr : []).filter(Number.isInteger)))
        .sort((a, b) => a - b)
        .join(",");

    const pvvRows = combinaciones.add.map(e => ({
      did_producto: didProducto,
      ean: isNonEmpty(e.ean) ? String(e.ean).trim() : null,
      valores: setKey(e.variantes_valores),
    }));

    const insertedPvvs = await LightdataORM.insert({
      db,
      table: "productos_variantes_valores",
      quien: quien,
      data: pvvRows,
    });
    dataCreate.productos_variantes_valores = insertedPvvs;

    const combinacionesRows = [];
    for (let i = 0; i < combinaciones.add.length; i++) {
      const e = combinaciones.add[i];
      const did_pvv = insertedPvvs[i];
      const ecommerce = Array.isArray(e.ecommerce) ? e.ecommerce : [];

      for (const e of ecommerce) {
        combinacionesRows.push({
          did_producto: didProducto,
          did_cuenta: isNonEmpty(e.didCuenta) ? e.didCuenta : null,
          did_producto_variante_valor: did_pvv,
          sku: isNonEmpty(e.sku) ? String(e.sku).trim() : null,
          actualizar: 0,
          sync: isDefined(e.sync) ? number01(e.sync) : 0,
        });
      }
    }

    if (combinacionesRows.length) {

      const productos_ecommerce = await LightdataORM.insert({
        db,
        table: "productos_ecommerce",
        quien: quien,
        data: combinacionesRows,
      });

      dataCreate.productos_ecommerce = productos_ecommerce;
    }
  }

  const es_combo = productos_hijos != null ? 1 : 0;

  if (es_combo == 1) {
    const hayProductosHijos = getUpdateOpsState(productos_hijos);
    if (hayProductosHijos.hasRemove) {
      await LightdataORM.delete({
        db,
        table: "productos_combos",
        where: { did: hayProductosHijos.didsRemove },
        quien,
      });

    } if (hayProductosHijos.hasUpdate) {
      const dataUpdate = hayProductosHijos.update.map(c => ({
        cantidad: Number(c.cantidad),
      }));
      await LightdataORM.update({
        db,
        table: "productos_combos",
        where: {
          did_producto: didProducto,
          did: hayProductosHijos.didsUpdate
        },
        data: dataUpdate,
        quien,
      });
    }
    if (hayProductosHijos.hasAdd) {
      const data = hayProductosHijos.add.map(ph => ({
        did_producto: didProducto,
        did_producto_combo: ph.didProducto,
        cantidad: Number(ph.cantidad),
      }));
      const combosInsert = await LightdataORM.insert({
        db,
        table: "productos_combos",
        data,
        quien,
      });
      dataCreate.combos = combosInsert;
    }
  }
  const hayInsumos = getUpdateOpsState(insumos);
  if (hayInsumos.hasRemove) {
    await LightdataORM.delete({
      db,
      table: "productos_insumos",
      where: { did: hayInsumos.didsRemove, did_producto: didProducto },
      quien,
    });
  }

  if (hayInsumos.hasUpdate) {
    const didsUpdate = hayInsumos.update.map(i => i.did);
    const dataUpdate = insumos.update.map(i => ({
      did_producto: didProducto,
      cantidad: Number(i.cantidad),
    }));
    await LightdataORM.update({
      db,
      table: "productos_insumos",
      where: { did: didsUpdate },
      data: dataUpdate,
      quien,
    });
  }
  if (hayInsumos.hasAdd) {
    //preguntar habilitado
    const data = hayInsumos.add.map(i => ({
      habilitado: 1,
      did_insumo: i.didInsumo,
      did_producto: didProducto,
      cantidad: Number(i.cantidad),
    }));
    const insumosInsert = await LightdataORM.insert({
      db,
      table: "productos_insumos",
      data,
      quien,
    });
    dataCreate.insumos = insumosInsert;
  }

  return {
    success: true,
    message: "Producto versionado correctamente (ORM)",
    data: {
      did: didProducto,
      titulo: newData.titulo,
      data_create: dataCreate,
      meta: { timestamp: new Date().toISOString() },
    }

  }
};

function getUpdateOpsState(updateArray) {
  const add = toArray(updateArray?.add);
  const update = toArray(updateArray?.update);
  const remove = toArray(updateArray?.remove);

  const hasAdd = add.length > 0;
  const hasUpdate = update.length > 0;
  const hasRemove = remove.length > 0;

  const getId = (x) => (x && (x.did ?? x.did)) ?? x ?? null;
  const isValidId = (v) => v !== null && v !== undefined && v !== '';

  const didsUpdate = hasUpdate ? update.map(getId).filter(isValidId) : [];
  const didsRemove = hasRemove ? remove.map(getId).filter(isValidId) : [];

  return {
    hasAdd,
    hasUpdate,
    hasRemove,
    add,
    update,
    remove,
    didsUpdate,
    didsRemove,
  };
}

const toArray = (v) => Array.isArray(v) ? v : [];
