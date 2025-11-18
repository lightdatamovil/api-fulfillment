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
    dids_ie,
    tiene_ie
  } = req.body;

  const { did } = req.params;
  const quien = Number(req.user.userId);
  const { companyId } = req.user;
  const didProducto = Number(did);

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

  // identificadores especiales
  // lo que venga lo reemplazo 

  // let tiene_ie = 0;
  let dids_ie_insert = null;

  if (Array.isArray(dids_ie) && dids_ie.length) {
    dids_ie_insert = setKey(dids_ie);
    //   console.log('DIDS IE obtenidos:', dids_ie);
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
    tiene_ie,
    dids_ie: dids_ie_insert
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
    const didVarianteUpdate = [];

    for (const combinacion of hayCombinaciones.update) {
      const ean = isNonEmpty(combinacion.ean) ? String(combinacion.ean).trim() : null;
      const sync = isDefined(combinacion.sync) ? number01(combinacion.sync) : 0;

      //añadir a la variante
      didVarianteUpdate.push({
        did: combinacion.did,
        ean: ean,
        sync: sync
      });



      /*
      await LightdataORM.update({
        db,
        table: "productos_variantes_valores",
        where: {
          did: combinacion.did
        },
        data: {
          ean,
          actualizar: 0,
          sync
        }
      });
      */

      for (const tienda of combinacion.tiendas) {
        didCuentaUpdate.push(tienda.did);
        dataUpdateCombinaciones.push({
          did_producto: didProducto,
          did_cuenta: tienda.didCuenta,
          sku: tienda.sku,
          actualizar: 0,
        });
      }
    }

    // console.log('Actualizando combinacion:', didVarianteUpdate);



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
      valores: setKey(e.valores),
      sync: e.sync,
    }));

    //   console.log('pvvRows', pvvRows);

    const insertedPvvs = await LightdataORM.insert({
      db,
      table: "productos_variantes_valores",
      quien: quien,
      data: pvvRows,
    });

    const combinacionesRows = [];
    for (let i = 0; i < combinaciones.add.length; i++) {
      const e = combinaciones.add[i];
      const did_pvv = insertedPvvs[i];
      const tienda = Array.isArray(e.tiendas) ? e.tiendas : [];

      for (const t of tienda) {
        combinacionesRows.push({
          did_producto: didProducto,
          did_cuenta: isNonEmpty(t.didCuenta) ? t.didCuenta : null,
          did_producto_variante_valor: did_pvv,
          sku: isNonEmpty(t.sku) ? String(t.sku).trim() : null,
          actualizar: 0,
          //   sync: isDefined(e.sync) ? number01(e.sync) : 0,
        });
      }
    }

    if (combinacionesRows.length) {
      await LightdataORM.insert({
        db,
        table: "productos_ecommerce",
        quien: quien,
        data: combinacionesRows,
      });
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
      await LightdataORM.insert({
        db,
        table: "productos_combos",
        data,
        quien,
      });
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
    await LightdataORM.insert({
      db,
      table: "productos_insumos",
      data,
      quien,
    });
  }

  return {
    success: true,
    message: "Producto versionado correctamente (ORM)",
    data: {
      did: didProducto,
      titulo: newData.titulo,
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

const setKey = (arr) =>
  Array.from(new Set((Array.isArray(arr) ? arr : []).filter(Number.isInteger)))
    .sort((a, b) => a - b)
    .join(","); // juntar por ,