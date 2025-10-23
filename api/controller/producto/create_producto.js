import axios from "axios";
import {
    CustomException,
    Status,
    isNonEmpty,
    isDefined,
    number01,
    LightdataORM,
} from "lightdata-tools";
import { urlSubidaImagenes } from "../../db.js";

export async function createProducto(dbConnection, req) {
    const {
        didCliente,
        titulo,
        descripcion,
        habilitado,
        es_combo,
        posicion,
        cm3,
        alto,
        ancho,
        profundo,
        didCurva,
        sku,
        ean,
        imagen,
        ecommerce,
        insumos,
        combos,
    } = req.body;

    const { userId, companyId } = req.user;

    // 🧩 Validación de SKU duplicado
    await LightdataORM.select({
        dbConnection,
        table: "productos",
        where: { sku },
        throwIfExists: true,
    });

    // 🧩 Verificación de cliente existente
    const [client] = await LightdataORM.select({
        dbConnection,
        table: "clientes",
        where: { did: didCliente },
        throwIfNotExists: true,
    });

    // 🧩 Inserción del producto principal
    const [idProducto] = await LightdataORM.insert({
        dbConnection,
        table: "productos",
        quien: userId,
        data: {
            did_cliente: didCliente,
            titulo,
            descripcion,
            imagen: null,
            habilitado: number01(habilitado),
            es_combo: number01(es_combo),
            posicion,
            cm3,
            alto,
            ancho,
            profundo,
            did_curva: didCurva,
            sku,
            ean,
        },
    });

    // 🧩 Ecommerce
    if (Array.isArray(ecommerce) && ecommerce.length) {
        const ecommerceData = [];

        for (let i = 0; i < ecommerce.length; i++) {
            const e = ecommerce[i];

            const did_cuenta = Number(e?.didCuenta);
            if (!Number.isFinite(did_cuenta) || did_cuenta <= 0)
                throw new CustomException({
                    title: "Ecommerce inválido",
                    message: `ecommerce[${i}].didCuenta debe ser numérico válido`,
                    status: Status.badRequest,
                });

            const skuVal = isNonEmpty(e?.sku) ? String(e.sku).trim() : null;
            const eanVal = isNonEmpty(e?.ean) ? String(e.ean).trim() : null;
            const urlVal = isNonEmpty(e?.url) ? String(e.url).trim() : null;
            const sync = isDefined(e?.sync) ? number01(e.sync) : 0;

            if (![0, 1].includes(sync))
                throw new CustomException({
                    title: "Valor inválido",
                    message: `ecommerce[${i}].sync debe ser 0 o 1`,
                    status: Status.badRequest,
                });

            ecommerceData.push({
                did_producto: idProducto,
                did_cuenta,
                sku: skuVal,
                ean: eanVal,
                url: urlVal,
                actualizar: 0,
                sync,
            });

            // 📦 Variantes valores (si vienen anidadas)
            if (Array.isArray(e.variantes_valores) && e.variantes_valores.length) {
                const vv = e.variantes_valores
                    .map(Number)
                    .filter((n) => Number.isFinite(n) && n > 0);

                if (vv.length !== e.variantes_valores.length)
                    throw new CustomException({
                        title: "Valores de variantes inválidos",
                        message: `Todos los ecommerce[${i}].variantes_valores deben ser numéricos válidos`,
                        status: Status.badRequest,
                    });

                await LightdataORM.insert({
                    dbConnection,
                    table: "productos_variantes_valores",
                    quien: userId,
                    data: vv.map((did_variante_valor) => ({
                        did_producto: idProducto,
                        did_variante_valor,
                    })),
                });
            }
        }

        await LightdataORM.insert({
            dbConnection,
            table: "productos_ecommerce",
            quien: userId,
            data: ecommerceData,
        });
    }

    // 🧩 Insumos
    if (Array.isArray(insumos) && insumos.length) {
        const insumoData = insumos.map((it, i) => {
            const did_insumo = Number(it?.didInsumo);
            const cantidad = Number(it?.cantidad);

            if (!Number.isFinite(did_insumo) || did_insumo <= 0)
                throw new CustomException({
                    title: "Insumo inválido",
                    message: `insumos[${i}].didInsumo debe ser numérico válido`,
                    status: Status.badRequest,
                });

            if (!Number.isFinite(cantidad) || cantidad <= 0)
                throw new CustomException({
                    title: "Cantidad inválida",
                    message: `insumos[${i}].cantidad debe ser mayor que 0`,
                    status: Status.badRequest,
                });

            return {
                did_producto: idProducto,
                did_insumo,
                cantidad,
                habilitado: 1,
            };
        });

        await LightdataORM.insert({
            dbConnection,
            table: "productos_insumos",
            quien: userId,
            data: insumoData,
        });
    }

    // 🧩 Combos
    if (number01(es_combo) === 1) {
        if (!Array.isArray(combos) || !combos.length)
            throw new CustomException({
                title: "Items requeridos",
                message: "Debés enviar 'combos' con al menos un ítem.",
                status: Status.badRequest,
            });

        const items = combos.map((it, i) => {
            const did_producto_combo = Number(it?.didProducto);
            const cantidad = Number(it?.cantidad);

            if (!Number.isFinite(did_producto_combo) || did_producto_combo <= 0)
                throw new CustomException({
                    title: "Ítem inválido",
                    message: `combos[${i}].didProducto debe ser válido`,
                    status: Status.badRequest,
                });

            if (!Number.isFinite(cantidad) || cantidad <= 0)
                throw new CustomException({
                    title: "Cantidad inválida",
                    message: `combos[${i}].cantidad debe ser > 0`,
                    status: Status.badRequest,
                });

            if (did_producto_combo === idProducto)
                throw new CustomException({
                    title: "Referencia inválida",
                    message: "Un combo no puede referenciarse a sí mismo",
                    status: Status.badRequest,
                });

            return { did_producto_combo, cantidad };
        });

        // Validar existencia de productos hijos
        const hijos = items.map((i) => i.did_producto_combo);
        const hijosValidos = await LightdataORM.select({
            dbConnection,
            table: "productos",
            where: { did: hijos },
            select: "did, es_combo",
        });

        const map = new Map(hijosValidos.map((r) => [r.did, r]));
        for (const { did_producto_combo } of items) {
            const row = map.get(did_producto_combo);
            if (!row)
                throw new CustomException({
                    title: "Producto hijo no válido",
                    message: `El producto hijo ${did_producto_combo} no existe o no está vigente`,
                    status: Status.badRequest,
                });
            if (row.es_combo)
                throw new CustomException({
                    title: "Combo anidado",
                    message: `El producto hijo ${did_producto_combo} es un combo`,
                    status: Status.badRequest,
                });
        }

        await LightdataORM.insert({
            dbConnection,
            table: "productos_combos",
            quien: userId,
            data: items.map((it) => ({
                did_producto: idProducto,
                did_producto_combo: it.did_producto_combo,
                cantidad: it.cantidad,
            })),
        });
    }

    // 🖼️ Subida de imagen (base64 o URL)
    if (isNonEmpty(imagen)) {
        await axios.post(
            urlSubidaImagenes,
            {
                file: imagen, // puede ser base64 o URL
                companyId,
                clientId: client.did,
                productId: idProducto,
            },
            { headers: { "Content-Type": "application/json" } }
        );
    }

    return {
        success: true,
        message: "Producto creado correctamente",
        data: { idProducto },
    };
}
