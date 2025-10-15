import axios from "axios";
import {
    CustomException,
    Status,
    isNonEmpty,
    isDefined,
    number01,
    LightdataORM
} from "lightdata-tools";
import { urlSubidaImagenes } from "../../db";

export async function createProducto(dbConnection, req) {
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
        depositos,
        insumos,
        variantesValores,
        ecommerce,
        sku,
        imagen,
        combo
    } = req.body;

    const { userId, companyId } = req.user;

    await LightdataORM.select({
        dbConnection,
        table: "productos",
        where: { sku },
        throwIfExists: true
    });

    await LightdataORM.select({
        dbConnection,
        table: "clientes",
        where: { did: did_cliente },
        throwIfNotExists: true
    });

    const [idProducto] = await LightdataORM.insert({
        dbConnection,
        table: "productos",
        quien: userId,
        data: {
            did_cliente,
            titulo,
            descripcion,
            imagen: null,
            habilitado,
            es_combo,
            posicion,
            cm3,
            alto,
            ancho,
            profundo
        }
    });

    if (Array.isArray(depositos) && depositos.length) {
        const depIds = depositos.map(Number).filter(n => Number.isFinite(n) && n > 0);
        if (depIds.length !== depositos.length)
            throw new CustomException({
                title: "Depósitos inválidos",
                message: "Todos los did_deposito deben ser numéricos válidos",
                status: Status.badRequest
            });

        await LightdataORM.insert({
            dbConnection,
            table: "productos_depositos",
            quien: userId,
            data: depIds.map(did_deposito => ({
                did_producto: idProducto,
                did_deposito
            }))
        });
    }

    if (Array.isArray(insumos) && insumos.length) {
        const data = insumos.map((it, i) => {
            const did_insumo = Number(it?.did_insumo);
            if (!Number.isFinite(did_insumo) || did_insumo <= 0)
                throw new CustomException({
                    title: "Insumo inválido",
                    message: `insumos[${i}].did_insumo debe ser numérico válido`,
                    status: Status.badRequest
                });

            const habilitadoVal = isDefined(it?.habilitado) ? number01(it.habilitado) : 1;
            if (![0, 1].includes(habilitadoVal))
                throw new CustomException({
                    title: "Valor inválido",
                    message: `insumos[${i}].habilitado debe ser 0 o 1`,
                    status: Status.badRequest
                });

            return { did_producto: idProducto, did_insumo, habilitado: habilitadoVal };
        });

        await LightdataORM.insert({
            dbConnection,
            table: "productos_insumos",
            quien: userId,
            data
        });
    }

    if (Array.isArray(variantesValores) && variantesValores.length) {
        const vv = variantesValores.map(Number).filter(n => Number.isFinite(n) && n > 0);
        if (vv.length !== variantesValores.length)
            throw new CustomException({
                title: "Valores de variantes inválidos",
                message: "Todos los did_variante_valor deben ser numéricos válidos",
                status: Status.badRequest
            });

        await LightdataORM.insert({
            dbConnection,
            table: "productos_variantes_valores",
            quien: userId,
            data: vv.map(did_variante_valor => ({
                did_producto: idProducto,
                did_variante_valor
            }))
        });
    }

    if (Array.isArray(ecommerce) && ecommerce.length) {
        const data = ecommerce.map((e, i) => {
            const did_cuenta = Number(e?.did_cuenta);
            if (!Number.isFinite(did_cuenta) || did_cuenta <= 0)
                throw new CustomException({
                    title: "Ecommerce inválido",
                    message: `ecommerce[${i}].did_cuenta debe ser numérico válido`,
                    status: Status.badRequest
                });

            const did_producto_valor =
                isDefined(e?.did_producto_valor) && Number.isFinite(Number(e.did_producto_valor))
                    ? Number(e.did_producto_valor)
                    : null;
            const skuVal = isNonEmpty(e?.sku) ? String(e.sku).trim() : null;
            const ean = isNonEmpty(e?.ean) ? String(e.ean).trim() : null;
            const url = isNonEmpty(e?.url) ? String(e.url).trim() : null;
            const sync = isDefined(e?.actualizar_sync) ? number01(e.actualizar_sync) : 0;
            if (![0, 1].includes(sync))
                throw new CustomException({
                    title: "Valor inválido",
                    message: `ecommerce[${i}].actualizar_sync debe ser 0 o 1`,
                    status: Status.badRequest
                });

            return {
                did_producto: idProducto,
                did_cuenta,
                did_producto_valor,
                sku: skuVal,
                ean,
                url,
                sync
            };
        });

        await LightdataORM.insert({
            dbConnection,
            table: "productos_ecommerce",
            quien: userId,
            data
        });
    }

    if (es_combo === 1) {
        if (!Array.isArray(combo) || !combo.length)
            throw new CustomException({
                title: "Items requeridos",
                message: "Debés enviar 'combo' con al menos un ítem.",
                status: Status.badRequest
            });

        const items = combo.map((it, i) => {
            const did_producto_combo = Number(it?.did_producto);
            const cantidad = Number(it?.cantidad);
            if (!Number.isFinite(did_producto_combo) || did_producto_combo <= 0)
                throw new CustomException({
                    title: "Ítem inválido",
                    message: `combo[${i}].did_producto debe ser válido`,
                    status: Status.badRequest
                });
            if (!Number.isFinite(cantidad) || cantidad <= 0)
                throw new CustomException({
                    title: "Cantidad inválida",
                    message: `combo[${i}].cantidad debe ser > 0`,
                    status: Status.badRequest
                });
            if (did_producto_combo === idProducto)
                throw new CustomException({
                    title: "Referencia inválida",
                    message: "Un combo no puede referenciarse a sí mismo",
                    status: Status.badRequest
                });
            return { did_producto_combo, cantidad };
        });

        const hijos = items.map(i => i.did_producto_combo);
        const hijosValidos = await LightdataORM.select({
            dbConnection,
            table: "productos",
            where: { did: hijos },
            select: "did, es_combo"
        });

        const map = new Map(hijosValidos.map(r => [r.did, r]));
        for (const { did_producto_combo } of items) {
            const row = map.get(did_producto_combo);
            if (!row)
                throw new CustomException({
                    title: "Producto hijo no válido",
                    message: `El producto hijo ${did_producto_combo} no existe o no está vigente`,
                    status: Status.badRequest
                });
            if (row.es_combo)
                throw new CustomException({
                    title: "Combo anidado",
                    message: `El producto hijo ${did_producto_combo} es un combo`,
                    status: Status.badRequest
                });
        }

        await LightdataORM.insert({
            dbConnection,
            table: "productos_combos",
            quien: userId,
            data: items.map(it => ({
                did_producto: idProducto,
                did_producto_combo: it.did_producto_combo,
                cantidad: it.cantidad
            }))
        });
    }

    const uploadRes = await axios.post(urlSubidaImagenes, {
        file: imagen,
        companyId,
        productId: idProducto
    }, { headers: { "Content-Type": "application/json" } });

    return {
        success: true,
        message: "Producto creado correctamente",
        data: { idProducto, imagen: uploadRes?.data?.url ?? null }
    };
}
