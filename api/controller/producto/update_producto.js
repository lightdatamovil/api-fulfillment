import { CustomException, executeQuery, Status, isNonEmpty, isDefined, number01 } from "lightdata-tools";

/**
 * Versiona un producto (no edita in-place).
 * - Supera la versión vigente (producto.superado=1) y crea una nueva con el mismo did.
 * - Si vienen arrays (depositos, insumos, variantesValores, ecommerce), se SUPERAN los links vigentes y se reinsertan.
 * - Combo:
 *    - Si newEsCombo = 1 y viene "combo": se superan e insertan las líneas nuevas.
 *    - Si newEsCombo = 0: se superan las líneas vigentes (el producto deja de ser combo).
 *    - Si no viene "combo": NO se tocan las líneas (salvo que newEsCombo=0).
 */
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

    depositos,          // opcional para resync
    insumos,            // opcional para resync
    variantesValores,   // opcional para resync
    ecommerce,          // opcional para resync
    combo,              // opcional (si newEsCombo=1 y querés resync)
  } = req.body;

  const { userId } = req.user;

  const didProducto = Number(did);
  if (!Number.isFinite(didProducto) || didProducto <= 0) {
    throw new CustomException({
      title: "Parámetro inválido",
      message: "Se requiere 'did' numérico válido",
      status: Status.badRequest,
    });
  }

  // Traer vigente actual
  const currRows = await executeQuery(
    dbConnection,
    `
      SELECT id, did, did_cliente, titulo, descripcion, imagen, habilitado, es_combo,
             posicion, cm3, alto, ancho, profundo
      FROM productos
      WHERE did = ? AND elim = 0 AND superado = 0
      ORDER BY id DESC
      LIMIT 1
    `,
    [didProducto]
  );

  if (!currRows || currRows.length === 0) {
    throw new CustomException({
      title: "No encontrado",
      message: `No existe un producto vigente con did ${didProducto}`,
      status: Status.notFound,
    });
  }

  const curr = currRows[0];

  // Normalizaciones / nuevos valores (fallback a curr)
  const newTitulo = isNonEmpty(titulo) ? String(titulo).trim() : curr.titulo;
  const newDesc = isNonEmpty(descripcion) ? String(descripcion).trim() : curr.descripcion;
  const newImg = isNonEmpty(imagen) ? String(imagen).trim() : curr.imagen;

  let newHab = curr.habilitado;
  if (isDefined(habilitado)) {
    const hv = number01(habilitado);
    if (hv !== 0 && hv !== 1) {
      throw new CustomException({ title: "Valor inválido", message: "habilitado debe ser 0 o 1", status: Status.badRequest });
    }
    newHab = hv;
  }

  let newEsCombo = curr.es_combo;
  if (isDefined(es_combo)) {
    const cv = number01(es_combo);
    if (cv !== 0 && cv !== 1) {
      throw new CustomException({ title: "Valor inválido", message: "es_combo debe ser 0 o 1", status: Status.badRequest });
    }
    newEsCombo = cv;
  }

  const newDidCliente = isDefined(did_cliente) && Number.isFinite(Number(did_cliente)) ? Number(did_cliente) : curr.did_cliente;
  const newPos = isDefined(posicion) && Number.isFinite(Number(posicion)) ? Number(posicion) : curr.posicion ?? 0;
  const newCm3 = isDefined(cm3) && Number.isFinite(Number(cm3)) ? Number(cm3) : curr.cm3 ?? 0;
  const newAlto = isDefined(alto) && Number.isFinite(Number(alto)) ? Number(alto) : curr.alto ?? 0;
  const newAncho = isDefined(ancho) && Number.isFinite(Number(ancho)) ? Number(ancho) : curr.ancho ?? 0;
  const newProf = isDefined(profundo) && Number.isFinite(Number(profundo)) ? Number(profundo) : curr.profundo ?? 0;

  // 1) Superar versión vigente
  await executeQuery(
    dbConnection,
    `UPDATE productos SET superado = 1 WHERE did = ? AND elim = 0 AND superado = 0`,
    [didProducto],
    true
  );

  // 2) Insertar nueva versión (mismo did)
  const ins = await executeQuery(
    dbConnection,
    `
      INSERT INTO productos
        (did_cliente, titulo, descripcion, imagen, habilitado, es_combo,
         posicion, cm3, alto, ancho, profundo,
         quien, superado, elim)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `,
    [
      newDidCliente, newTitulo, newDesc, newImg, newHab, newEsCombo,
      newPos, newCm3, newAlto, newAncho, newProf,
      userId
    ],
    true
  );

  if (!ins || ins.affectedRows === 0) {
    throw new CustomException({
      title: "Error al versionar producto",
      message: "No se pudo insertar la nueva versión del producto",
      status: Status.internalServerError,
    });
  }

  const newId = ins.insertId;
  await executeQuery(
    dbConnection,
    `UPDATE productos SET did = ? WHERE id = ?`,
    [didProducto, newId],
    true
  );

  // ----- Asociaciones: resync SOLO si el array vino en el body -----

  // Depósitos
  if (Array.isArray(depositos)) {
    await executeQuery(
      dbConnection,
      `UPDATE productos_depositos SET superado = 1 WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto],
      true
    );
    for (const d of depositos) {
      const didDeposito = Number(d);
      if (!Number.isFinite(didDeposito) || didDeposito <= 0) {
        throw new CustomException({ title: "Depósito inválido", message: "did_deposito debe ser numérico válido", status: Status.badRequest });
      }
      await executeQuery(
        dbConnection,
        `INSERT INTO productos_depositos (did_producto, did_deposito, quien, superado, elim) VALUES (?, ?, ?, 0, 0)`,
        [didProducto, didDeposito, userId],
        true
      );
    }
  }

  // Insumos
  if (Array.isArray(insumos)) {
    await executeQuery(
      dbConnection,
      `UPDATE productos_insumos SET superado = 1 WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto],
      true
    );
    for (let i = 0; i < insumos.length; i++) {
      const it = insumos[i];
      const didInsumo = Number(it?.did_insumo);
      if (!Number.isFinite(didInsumo) || didInsumo <= 0) {
        throw new CustomException({ title: "Insumo inválido", message: `insumos[${i}].did_insumo debe ser numérico válido`, status: Status.badRequest });
      }
      let insHab = 1;
      if (isDefined(it?.habilitado)) {
        const hv = number01(it.habilitado);
        if (hv !== 0 && hv !== 1) {
          throw new CustomException({ title: "Valor inválido", message: `insumos[${i}].habilitado debe ser 0 o 1`, status: Status.badRequest });
        }
        insHab = hv;
      }
      await executeQuery(
        dbConnection,
        `INSERT INTO productos_insumos (did_producto, did_insumo, habilitado, quien, superado, elim) VALUES (?, ?, ?, ?, 0, 0)`,
        [didProducto, didInsumo, insHab, userId],
        true
      );
    }
  }

  // Variantes - valores
  if (Array.isArray(variantesValores)) {
    await executeQuery(
      dbConnection,
      `UPDATE productos_variantes_valores SET superado = 1 WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto],
      true
    );
    for (const v of variantesValores) {
      const didVarVal = Number(v);
      if (!Number.isFinite(didVarVal) || didVarVal <= 0) {
        throw new CustomException({ title: "Valor de variante inválido", message: "did_variante_valor debe ser numérico válido", status: Status.badRequest });
      }
      await executeQuery(
        dbConnection,
        `INSERT INTO productos_variantes_valores (did_producto, did_variante_valor, quien, superado, elim) VALUES (?, ?, ?, 0, 0)`,
        [didProducto, didVarVal, userId],
        true
      );
    }
  }

  // Ecommerce
  if (Array.isArray(ecommerce)) {
    await executeQuery(
      dbConnection,
      `UPDATE productos_ecommerce SET superado = 1 WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto],
      true
    );
    for (let i = 0; i < ecommerce.length; i++) {
      const e = ecommerce[i];
      const didCuenta = Number(e?.did_cuenta);
      if (!Number.isFinite(didCuenta) || didCuenta <= 0) {
        throw new CustomException({ title: "Ecommerce inválido", message: `ecommerce[${i}].did_cuenta debe ser numérico válido`, status: Status.badRequest });
      }
      const didProductoValor = isDefined(e?.did_producto_valor) && Number.isFinite(Number(e.did_producto_valor)) ? Number(e.did_producto_valor) : null;
      const sku = isNonEmpty(e?.sku) ? String(e.sku).trim() : null;
      const ean = isNonEmpty(e?.ean) ? String(e.ean).trim() : null;
      const url = isNonEmpty(e?.url) ? String(e.url).trim() : null;
      let actualizarSync = 0;
      if (isDefined(e?.actualizar_sync)) {
        const s = number01(e.actualizar_sync);
        if (s !== 0 && s !== 1) {
          throw new CustomException({ title: "Valor inválido", message: `ecommerce[${i}].actualizar_sync debe ser 0 o 1`, status: Status.badRequest });
        }
        actualizarSync = s;
      }
      await executeQuery(
        dbConnection,
        `
          INSERT INTO productos_ecommerce
            (did_producto, did_cuenta, did_producto_valor, sku, ean, url, sync, quien, superado, elim)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `,
        [didProducto, didCuenta, didProductoValor, sku, ean, url, actualizarSync, userId],
        true
      );
    }
  }

  // Combo
  if (newEsCombo === 0) {
    // si dejó de ser combo: superar líneas vigentes
    await executeQuery(
      dbConnection,
      `UPDATE productos_combos SET superado = 1 WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto],
      true
    );
  } else if (newEsCombo === 1 && Array.isArray(combo)) {
    // resync de composición
    await executeQuery(
      dbConnection,
      `UPDATE productos_combos SET superado = 1 WHERE did_producto = ? AND elim = 0 AND superado = 0`,
      [didProducto],
      true
    );

    // validar e insertar
    const itemsNorm = combo.map((it, idx) => {
      const didHijo = Number(it?.did_producto);
      const cant = Number(it?.cantidad);
      if (!Number.isFinite(didHijo) || didHijo <= 0) {
        throw new CustomException({ title: "Ítem inválido", message: `combo[${idx}].did_producto debe ser numérico válido`, status: Status.badRequest });
      }
      if (!Number.isFinite(cant) || cant <= 0) {
        throw new CustomException({ title: "Cantidad inválida", message: `combo[${idx}].cantidad debe ser > 0`, status: Status.badRequest });
      }
      if (didHijo === didProducto) {
        throw new CustomException({ title: "Referencia inválida", message: "Un combo no puede referenciarse a sí mismo", status: Status.badRequest });
      }
      return { did_producto: didHijo, cantidad: cant };
    });

    // Validar hijos existen y no combos (si no permitís anidados)
    if (itemsNorm.length > 0) {
      const hijos = itemsNorm.map(i => i.did_producto);
      const placeholders = hijos.map(() => "?").join(", ");
      const hijosRows = await executeQuery(
        dbConnection,
        `SELECT did, es_combo, elim, superado FROM productos WHERE did IN (${placeholders})`,
        hijos
      );
      const mapHijos = new Map((hijosRows || []).map(r => [Number(r.did), r]));
      for (const { did_producto: d } of itemsNorm) {
        const row = mapHijos.get(d);
        if (!row || Number(row.elim) === 1 || Number(row.superado) === 1) {
          throw new CustomException({ title: "Producto hijo no válido", message: `El producto hijo DID ${d} no existe o no está vigente`, status: Status.badRequest });
        }
        if (Number(row.es_combo) === 1) {
          throw new CustomException({ title: "Combo anidado no permitido", message: `El producto hijo DID ${d} es un combo`, status: Status.badRequest });
        }
      }
    }

    for (const it of itemsNorm) {
      await executeQuery(
        dbConnection,
        `INSERT INTO productos_combos (did_producto, did_producto_combo, cantidad, quien, superado, elim) VALUES (?, ?, ?, ?, 0, 0)`,
        [didProducto, it.did_producto, it.cantidad, userId],
        true
      );
    }
  }

  return {
    success: true,
    message: "Producto versionado correctamente",
    data: { did: didProducto, idVersionNueva: newId, titulo: newTitulo, es_combo: newEsCombo },
    meta: { timestamp: new Date().toISOString() },
  };
}
