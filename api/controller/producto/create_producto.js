// controller/productos/create_producto.js
import axios from "axios";
import { CustomException, executeQuery, Status, isNonEmpty, isDefined, number01, LightdataORM } from "lightdata-tools";


const UPLOAD_URL = "https://files.lightdata.app/upload_fulfillment_images.php";

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
        did_cliente, titulo, descripcion,
        habilitado, es_combo, posicion,
        cm3, alto, ancho, profundo,

        depositos,
        insumos,
        variantesValores,
        ecommerce,
        sku,

        imagen, //agregar imagen

        combo, // SOLO si es_combo = 1
    } = req.body;

    const { userId, companyId } = req.user;

    // evrifico si esta repetido por SKU
    await LightdataORM.select({
        dbConnection,
        table: "productos",
        where: { sku: sku },
        throwIfNotExists: true
    });

    // verifico si existe el cliente
    await LightdataORM.select({
        dbConnection,
        table: "clientes",
        where: { did: did_cliente },
        throwIfNotExists: true
    });


    // combos verificar si es producto-combo


    // inserto producto
    const idProducto = await LightdataORM.insert({
        dbConnection,
        table: "productos",
        quien: userId,
        data: {
            did_cliente: did_cliente,
            titulo: titulo,
            descripcion: descripcion,
            imagen: null,
            habilitado: habilitado,
            es_combo: es_combo,
            posicion: posicion,
            cm3: cm3,
            alto: alto,
            ancho: ancho,
            profundo: profundo,
        }
    });


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
                [idProducto, didDeposito, userId],
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
                [idProducto, didInsumo, insHab, userId],
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
                [idProducto, didVarVal, userId],
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
                [idProducto, didCuenta, didProductoValor, sku, ean, url, actualizarSync, userId],
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
            if (didHijo === idProducto) {
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
                [idProducto, it.did_producto, it.cantidad, userId],
                true
            );
            if (insCombo && insCombo.affectedRows > 0) countComboItems += 1;
        }
    }


    //subir imagen al microservicio de archivos que reciba la url de la imagen   ACA y updatear la url en producto
    const uploadImageUrl = await axios.post(
        UPLOAD_URL,
        {
            file: imagen,
            companyId: companyId,
            productId: idProducto

        },
        { headers: { "Content-Type": "application/json" } }
    );


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
                imagen: uploadImageUrl, //image
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
