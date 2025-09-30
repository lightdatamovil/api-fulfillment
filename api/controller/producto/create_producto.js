// controller/productos/create_producto.js
import { CustomException, executeQuery, Status, isNonEmpty, isDefined, number01 } from "lightdata-tools";

/**
 * Crea un producto y sus asociaciones opcionales.
 * - Tabla principal: producto
 * - Asociaciones:
 *    - productos_depositos(did_producto, did_deposito, quien, superado, elim)
 *    - productos_insumos(did_producto, did_insumo, habilitado, quien, superado, elim)
 *    - productos_variantes_valores(did_producto, did_variante_valor, quien, superado, elim)
 *    - productos_ecommerce(did_producto, did_cuenta, did_producto_valor, sku, ean, url, actualizar_sync, quien, superado, elim)
 *    - (si es_combo=1) productos_combo(did_producto, did_producto_combo, cantidad, quien, superado, elim)
 *
 * Body esperado (claves principales):
 * {
 *   titulo: string (requerido),
 *   did_cliente?: number | null,
 *   descripcion?: string, imagen?: string, habilitado?: 0|1, es_combo?: 0|1,
 *   posicion?: number, cm3?: number, alto?: number, ancho?: number, profundo?: number,
 *   depositos?: number[],
 *   insumos?: [{ did_insumo: number, habilitado?: 0|1 }],
 *   variantesValores?: number[],
 *   ecommerce?: [{ did_cuenta: number, did_producto_valor?: number, sku?: string, ean?: string, url?: string, actualizar_sync?: 0|1 }],
 *   combo?: [{ did_producto: number, cantidad: number }] // REQUERIDO si es_combo=1
 * }
 */
export async function createProducto(dbConnection, req) {
    const {
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

        combo, // SOLO si es_combo = 1
    } = req.body;

    const { userId } = req.user;

    // ---------- Normalizaciones ----------
    const tituloTrim = isNonEmpty(titulo) ? String(titulo).trim() : "";
    if (!isNonEmpty(tituloTrim)) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "El campo 'titulo' es requerido para crear el producto",
            status: Status.badRequest,
        });
    }

    const descTrim = isNonEmpty(descripcion) ? String(descripcion).trim() : null;
    const imagenTrim = isNonEmpty(imagen) ? String(imagen).trim() : null;

    const didClienteValue =
        isDefined(did_cliente) && Number.isFinite(Number(did_cliente))
            ? Number(did_cliente)
            : null;

    let habValue = 1;
    if (isDefined(habilitado)) {
        const hv = number01(habilitado);
        if (hv !== 0 && hv !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "habilitado debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        habValue = hv;
    }

    let comboValue = 0;
    if (isDefined(es_combo)) {
        const cv = number01(es_combo);
        if (cv !== 0 && cv !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "es_combo debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        comboValue = cv;
    }

    const posValue = Number.isFinite(Number(posicion)) ? Number(posicion) : 0;
    const cm3Value = Number.isFinite(Number(cm3)) ? Number(cm3) : 0;
    const altoValue = Number.isFinite(Number(alto)) ? Number(alto) : 0;
    const anchoValue = Number.isFinite(Number(ancho)) ? Number(ancho) : 0;
    const profundoValue = Number.isFinite(Number(profundo)) ? Number(profundo) : 0;

    const checkexist = "SELECT id FROM productos WHERE titulo = ? AND elim = 0";
    const exist = await executeQuery(dbConnection, checkexist, [tituloTrim]);
    if (exist && exist.length > 0) {
        throw new CustomException({
            title: "Título duplicado",
            message: `Ya existe un producto con el título '${tituloTrim}'`,
            status: Status.badRequest,
        });
    }

    // ---------- Insert producto ----------
    const insSql = `
    INSERT INTO productos (
      did_cliente, titulo, descripcion, imagen, habilitado, es_combo,
      posicion, cm3, alto, ancho, profundo,
      quien, superado, elim
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `;
    const ins = await executeQuery(
        dbConnection,
        insSql,
        [
            didClienteValue,
            tituloTrim,
            descTrim,
            imagenTrim,
            habValue,
            comboValue,
            posValue,
            cm3Value,
            altoValue,
            anchoValue,
            profundoValue,
            userId,
        ],
        true
    );

    if (!ins || ins.affectedRows === 0) {
        throw new CustomException({
            title: "Error al crear producto",
            message: "No se pudo insertar el producto",
            status: Status.internalServerError,
        });
    }

    const idProducto = ins.insertId;

    // did == id
    await executeQuery(
        dbConnection,
        `UPDATE productos SET did = ? WHERE id = ?`,
        [idProducto, idProducto],
        true
    );
    const didProducto = idProducto;

    // ---------- Asociaciones opcionales ----------

    // Depósitos
    let countDepositos = 0;
    if (Array.isArray(depositos) && depositos.length > 0) {
        const depIds = depositos
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        if (depIds.length !== depositos.length) {
            throw new CustomException({
                title: "Depósitos inválidos",
                message: "Todos los did_deposito deben ser numéricos válidos",
                status: Status.badRequest,
            });
        }

        for (const didDeposito of depIds) {
            const insDep = await executeQuery(
                dbConnection,
                `
          INSERT INTO productos_depositos (did_producto, did_deposito, quien, superado, elim)
          VALUES (?, ?, ?, 0, 0)
        `,
                [didProducto, didDeposito, userId],
                true
            );
            if (insDep && insDep.affectedRows > 0) countDepositos += 1;
        }
    }

    // Insumos
    let countInsumos = 0;
    if (Array.isArray(insumos) && insumos.length > 0) {
        for (let i = 0; i < insumos.length; i++) {
            const it = insumos[i];
            const didInsumo = Number(it?.did_insumo);
            if (!Number.isFinite(didInsumo) || didInsumo <= 0) {
                throw new CustomException({
                    title: "Insumo inválido",
                    message: `insumos[${i}].did_insumo debe ser numérico válido`,
                    status: Status.badRequest,
                });
            }
            let insHab = 1;
            if (isDefined(it?.habilitado)) {
                const hv = number01(it.habilitado);
                if (hv !== 0 && hv !== 1) {
                    throw new CustomException({
                        title: "Valor inválido en insumos",
                        message: `insumos[${i}].habilitado debe ser 0 o 1`,
                        status: Status.badRequest,
                    });
                }
                insHab = hv;
            }

            const insIns = await executeQuery(
                dbConnection,
                `
          INSERT INTO productos_insumos (did_producto, did_insumo, habilitado, quien, superado, elim)
          VALUES (?, ?, ?, ?, 0, 0)
        `,
                [didProducto, didInsumo, insHab, userId],
                true
            );
            if (insIns && insIns.affectedRows > 0) countInsumos += 1;
        }
    }

    // Variantes - valores
    let countVarVals = 0;
    if (Array.isArray(variantesValores) && variantesValores.length > 0) {
        const vvIds = variantesValores
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);

        if (vvIds.length !== variantesValores.length) {
            throw new CustomException({
                title: "Valores de variantes inválidos",
                message: "Todos los did_variante_valor deben ser numéricos válidos",
                status: Status.badRequest,
            });
        }

        for (const didVarVal of vvIds) {
            const insVV = await executeQuery(
                dbConnection,
                `
          INSERT INTO productos_variantes_valores (did_producto, did_variante_valor, quien, superado, elim)
          VALUES (?, ?, ?, 0, 0)
        `,
                [didProducto, didVarVal, userId],
                true
            );
            if (insVV && insVV.affectedRows > 0) countVarVals += 1;
        }
    }

    // Ecommerce
    let countEcom = 0;
    if (Array.isArray(ecommerce) && ecommerce.length > 0) {
        for (let i = 0; i < ecommerce.length; i++) {
            const e = ecommerce[i];
            const didCuenta = Number(e?.did_cuenta);
            if (!Number.isFinite(didCuenta) || didCuenta <= 0) {
                throw new CustomException({
                    title: "Ecommerce inválido",
                    message: `ecommerce[${i}].did_cuenta debe ser numérico válido`,
                    status: Status.badRequest,
                });
            }

            const didProductoValor =
                isDefined(e?.did_producto_valor) && Number.isFinite(Number(e.did_producto_valor))
                    ? Number(e.did_producto_valor)
                    : null;

            const sku = isNonEmpty(e?.sku) ? String(e.sku).trim() : null;
            const ean = isNonEmpty(e?.ean) ? String(e.ean).trim() : null;
            const url = isNonEmpty(e?.url) ? String(e.url).trim() : null;

            let actualizarSync = 0;
            if (isDefined(e?.actualizar_sync)) {
                const s = number01(e.actualizar_sync);
                if (s !== 0 && s !== 1) {
                    throw new CustomException({
                        title: "Valor inválido en ecommerce",
                        message: `ecommerce[${i}].actualizar_sync debe ser 0 o 1`,
                        status: Status.badRequest,
                    });
                }
                actualizarSync = s;
            }

            const insEc = await executeQuery(
                dbConnection,
                `
          INSERT INTO productos_ecommerce
            (did_producto, did_cuenta, did_producto_valor, sku, ean, url, sync, quien, superado, elim)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `,
                [didProducto, didCuenta, didProductoValor, sku, ean, url, actualizarSync, userId],
                true
            );
            if (insEc && insEc.affectedRows > 0) countEcom += 1;
        }
    }

    // ---------- Si es combo: validar y crear composición ----------
    let countComboItems = 0;
    if (comboValue === 1) {
        if (!Array.isArray(combo) || combo.length === 0) {
            throw new CustomException({
                title: "Items requeridos para combo",
                message: "Al crear un producto con es_combo=1 debés enviar 'combo' con al menos un ítem.",
                status: Status.badRequest,
            });
        }

        // Normalizar + validar
        const itemsNorm = combo.map((it, idx) => {
            const didHijo = Number(it?.did_producto);
            const cant = Number(it?.cantidad);
            if (!Number.isFinite(didHijo) || didHijo <= 0) {
                throw new CustomException({
                    title: "Ítem inválido",
                    message: `combo[${idx}].did_producto debe ser un número válido`,
                    status: Status.badRequest,
                });
            }
            if (!Number.isFinite(cant) || cant <= 0) {
                throw new CustomException({
                    title: "Cantidad inválida",
                    message: `combo[${idx}].cantidad debe ser > 0`,
                    status: Status.badRequest,
                });
            }
            if (didHijo === didProducto) {
                throw new CustomException({
                    title: "Referencia inválida",
                    message: "Un combo no puede referenciarse a sí mismo",
                    status: Status.badRequest,
                });
            }
            return { did_producto: didHijo, cantidad: cant };
        });

        // Validar existencia y vigencia de hijos (y evitar combos anidados)
        const hijos = itemsNorm.map(i => i.did_producto);
        const placeholders = hijos.map(() => "?").join(", ");
        const hijosRows = await executeQuery(
            dbConnection,
            `
        SELECT did, es_combo, elim, superado
        FROM producto
        WHERE did IN (${placeholders})
      `,
            hijos
        );
        const mapHijos = new Map((hijosRows || []).map(r => [Number(r.did), r]));

        for (const { did_producto: d } of itemsNorm) {
            const row = mapHijos.get(d);
            if (!row || Number(row.elim) === 1 || Number(row.superado) === 1) {
                throw new CustomException({
                    title: "Producto hijo no válido",
                    message: `El producto hijo DID ${d} no existe o no está vigente`,
                    status: Status.badRequest,
                });
            }
            // Si NO querés combos anidados, forzamos:
            if (Number(row.es_combo) === 1) {
                throw new CustomException({
                    title: "Combo anidado no permitido",
                    message: `El producto hijo DID ${d} es un combo. No se permiten combos dentro de combos.`,
                    status: Status.badRequest,
                });
            }
        }

        // Insert composición
        for (const it of itemsNorm) {
            const insCombo = await executeQuery(
                dbConnection,
                `
          INSERT INTO productos_combos (did_producto, did_producto_combo, cantidad, quien, superado, elim)
          VALUES (?, ?, ?, ?, 0, 0)
        `,
                [didProducto, it.did_producto, it.cantidad, userId],
                true
            );
            if (insCombo && insCombo.affectedRows > 0) countComboItems += 1;
        }
    }

    // ---------- Respuesta ----------
    return {
        success: true,
        message: "Producto creado correctamente",
        data: {
            producto: {
                did: didProducto,
                did_cliente: didClienteValue,
                titulo: tituloTrim,
                descripcion: descTrim,
                imagen: imagenTrim,
                habilitado: habValue,
                es_combo: comboValue,
                posicion: posValue,
                cm3: cm3Value,
                alto: altoValue,
                ancho: anchoValue,
                profundo: profundoValue,
            },
            asociaciones: {
                depositos: countDepositos,
                insumos: countInsumos,
                variantesValores: countVarVals,
                ecommerce: countEcom,
                ...(comboValue === 1 ? { comboItems: countComboItems } : {}),
            },
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
