import { CustomException, Status, isNonEmpty, isDefined, number01, LightdataORM } from "lightdata-tools";
import { urlSubidaImagenes } from "../../db.js";
import axios from "axios";

export async function updateProducto(db, req) {
  const {
    did_cliente,
    titulo,
    descripcion,
    habilitado,
    es_combo,
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
    ecommerce,
    combos,
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
    console.log('urlResponse:', urlResponse.data);
    filesInsert = urlResponse.data.file.url;

  }

  //insertar producto de nuevo todo de nuevo
  const newData = {
    did_cliente,
    titulo,
    descripcion,
    habilitado,
    es_combo,
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

  //ECOMMERCE
  let ecommerceInsert;

  const hayEcomerce = getUpdateOpsState(ecommerce);
  if (hayEcomerce.hasRemove) {
    console.log('Entre a remove ecommerce');

    //preguntar a agus si vale borrar la variante
    await LightdataORM.delete({
      db,
      table: "productos_variantes_valores",
      where: { did_producto: didProducto, did: hayEcomerce.didsRemove },
      quien: quien,
    });
    await LightdataORM.delete({
      db,
      table: "productos_ecommerce",
      where: { did_producto: didProducto, did_producto_variante_valor: hayEcomerce.didsRemove },
      quien,
    });
  }

  if (hayEcomerce.hasUpdate) {
    console.log('Entre a update ecommerce');
    console.log(hayEcomerce.update);

    /*
    const dataUpdate = hayEcomerce.update.map(u => ({
      did_producto: didProducto,
      // convertir array de números a CSV normalizado
      valores: Array.isArray(u.variantes_valores)    ? Array.from(new Set(u.variantes_valores.filter(Number.isInteger)))
          .sort((a, b) => a - b)
          .join(",")
        : "",
    }));

    console.log('dataUpdate ecommerce:', dataUpdate);
    

    await LightdataORM.update({
      db,
      table: "productos_variantes_valores",
      where: { did_producto: didProducto, did: hayEcomerce.didsUpdate },
      data: dataUpdate,
      quien,
    });
    */
    let dataUpdateEcommerce = [];
    const didCuentaUpdate = [];

    for (const ecom of hayEcomerce.update) {
      console.log('ecom a update:', ecom);

      for (const grupo of ecom.grupos) {
        didCuentaUpdate.push(grupo.did);
        console.log('grupo a update:', grupo);
        dataUpdateEcommerce.push({
          did_producto: didProducto,
          did_cuenta: grupo.didCuenta,
          sku: grupo.sku,
          ean: grupo.ean,
          url: grupo.url,
          actualizar: 0,
          sync: grupo.sync,
        });
      }
    }
    console.log('didCuentaUpdate:', didCuentaUpdate);
    console.log('hayEcomerce.didsUpdate:', hayEcomerce.didsUpdate);
    console.log('dataUpdateEcommerce:', dataUpdateEcommerce);

    await LightdataORM.update({
      db: db,
      table: "productos_ecommerce",
      where: {
        did: didCuentaUpdate
      },
      data: dataUpdateEcommerce,
      quien,
    });
  }
  if (hayEcomerce.hasAdd) {
    const setKey = (arr) =>
      Array.from(new Set((Array.isArray(arr) ? arr : []).filter(Number.isInteger)))
        .sort((a, b) => a - b)
        .join(",");

    const pvvRows = ecommerce.add.map(e => ({
      did_producto: didProducto,
      valores: setKey(e.variantes_valores), // CSV normalizado del bloque
    }));
    console.log('pvvRows a insertar:', pvvRows);

    // 2) Insert masivo de PVV (uno por bloque). Orden de IDs = orden de pvvRows
    const insertedPvvs = await LightdataORM.insert({
      db,
      table: "productos_variantes_valores",
      quien: quien,
      data: pvvRows,
    }); // ej: [67, 68, ...] alineado con ecommerce[0], ecommerce[1], ...

    // 3) Con esos DID, armar todas las filas para productos_ecommerce
    const ecomRows = [];
    for (let i = 0; i < ecommerce.add.length; i++) {
      const e = ecommerce.add[i];
      const did_pvv = insertedPvvs[i]; // DID del conjunto de ese bloque
      const grupos = Array.isArray(e.grupos) ? e.grupos : [];

      for (const g of grupos) {
        ecomRows.push({
          did_producto: didProducto,
          did_cuenta: isNonEmpty(g.didCuenta) ? g.didCuenta : null,
          did_producto_variante_valor: did_pvv,
          sku: isNonEmpty(g.sku) ? String(g.sku).trim() : null,
          ean: isNonEmpty(g.ean) ? String(g.ean).trim() : null,
          url: isNonEmpty(g.url) ? String(g.url).trim() : null,
          actualizar: 0,
          sync: isDefined(g.sync) ? number01(g.sync) : 0,
        });
      }
    }

    // 4) Insert masivo de productos_ecommerce (una fila por grupo)
    if (ecomRows.length) {

      await LightdataORM.insert({
        db,
        table: "productos_ecommerce",
        quien: quien,
        data: ecomRows,
      });
    }
  }

  let combosInsert;

  // combos
  if (es_combo == 1) {

    const hayCombos = getUpdateOpsState(combos);
    console.log('Combos a procesar:', hayCombos);
    if (hayCombos.hasRemove) {
      await LightdataORM.delete({
        db,
        table: "productos_combos",
        where: { did: hayCombos.didsRemove },
        quien,
      });

    } if (hayCombos.hasUpdate) {
      const didsUpdate = hayCombos.update.map(c => c.did);
      const dataUpdate = hayCombos.update.map(c => ({
        did_producto: didProducto,
        cantidad: Number(c.cantidad),
      }));
      await LightdataORM.update({
        db,
        table: "productos_combos",
        where: { did_producto: didProducto, did: didsUpdate },
        data: dataUpdate,
        quien,
      });
    }
    if (hayCombos.hasAdd) {
      console.log('Entre a add combos');
      //     console.log(hayCombos.add);
      const data = hayCombos.add.map(c => ({
        did_producto: didProducto,
        did_producto_combo: c.didProducto,
        cantidad: Number(c.cantidad),
      }));
      const combosInsert = await LightdataORM.insert({
        db,
        table: "productos_combos",
        data,
        quien,
      });
    }

  }
  //insumos con cliente

  let insumosInsert;
  const hayInsumos = getUpdateOpsState(insumos);
  if (hayInsumos.hasRemove) {
    console.log('Entre a remove insumos');
    /* insumos_clientes no --- dudoso si borrar
    await LightdataORM.delete({
      db,
      table: "insumos_clientes",
      where: { did_insumo: hayInsumos.didsRemove, did_cliente: did_cliente },
      quien,
    });
  */
    await LightdataORM.delete({
      db,
      table: "productos_insumos",
      where: { did: hayInsumos.didsRemove, did_producto: didProducto },
      quien,
    });
  }

  if (hayInsumos.hasUpdate) {
    console.log('Entre a update insumos');
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
    //   console.log('Entre a add insumos');
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
      es_combo: es_combo,
      data_create: {
        ecommerce: ecommerceInsert,
        insumos: insumosInsert,
        combos: combosInsert,

      },
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
