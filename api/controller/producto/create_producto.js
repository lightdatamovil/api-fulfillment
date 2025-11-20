import axios from "axios";
import { CustomException, Status, isNonEmpty, number01, LightdataORM } from "lightdata-tools";
import { urlSubidaImagenes } from "../../db.js";

export async function createProducto({ db, req }) {
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
        did_curva,
        sku,
        files,
        combinaciones,
        insumos,
        productos_hijos,
        dids_ie
    } = req.body;

    const { userId, companyId } = req.user;

    const es_combo = productos_hijos && productos_hijos.length ? 1 : 0;

    const [productoEcommerceRow] = await LightdataORM.select({
        db,
        table: "productos_ecommerce",
        where: { sku },
        throwIfExists: true,
    });

    const didCuenta = productoEcommerceRow ? productoEcommerceRow.did_cuenta : null;

    const [clientesCuentasRow] = await LightdataORM.select({
        db,
        table: "clientes_cuentas",
        where: { did_cuenta: didCuenta },
        select: "flex",
    });
    const flex = clientesCuentasRow ? clientesCuentasRow.flex : 0;

    await LightdataORM.select({
        db,
        table: "clientes",
        where: { did: did_cliente },
        throwIfNotExists: true,
    });

    // IIDENTIFICADORES ESPECIALES
    let tiene_ie = 0;
    let dids_ie_insert = null;

    if (Array.isArray(dids_ie) && dids_ie.length) {
        tiene_ie = 1;
        dids_ie_insert = setKey(dids_ie);
        //   console.log('DIDS IE obtenidos:', dids_ie);

    }
    //  Inserción del producto principal
    const [didProducto] = await LightdataORM.insert({
        db,
        table: "productos",
        quien: userId,
        data: {
            did_cliente: did_cliente,
            titulo,
            descripcion,
            imagen: null,
            habilitado: number01(habilitado),
            es_combo,
            posicion,
            cm3,
            alto,
            ancho,
            profundo,
            did_curva,
            sku,
            tiene_ie,
            dids_ie: dids_ie_insert

        },
    });

    // 1) Buscar los did vigentes de ese seller_sku (y si querés, por empresa también)
    const rows = await LightdataORM.select({
        db,
        table: "pedidos_productos",
        where: { seller_sku: sku }, // acá sí podés meter más filtros si tu select los soporta
        select: ["did"],
        includeHistorical: false,
    });

    const dids = rows.map(r => r.did);
    // Nada que versionar
    if (dids.length > 0) {
        // 2) Armar data en batch para cada did (como te gusta, sin Promise.all)
        const dataBatch = dids.map(() => ({ did_producto: didProducto }));
        await LightdataORM.update({
            db,
            table: "pedidos_productos",
            where: { did: dids },   // ahora sí, versionKey numérico
            data: dataBatch,
            quien: userId,
            log: true,
        });
    }



    // =========================
    // 🛒 COMBINACIONES (siempre CREATE de PVV y luego insert de grupos)
    // =========================

    if (Array.isArray(combinaciones) && combinaciones.length) {
        // 1) Normalizar cada conjunto y preparar las filas de PVV (una por bloque)


        const combinacioneMapeadas = combinaciones.map(combinacion => ({
            did_producto: didProducto,
            valores: setKey(combinacion.valores),
            ean: combinacion.ean, // juntar valores de combinacion
            sync: combinacion.sync ?? 0,
        }));

        // 2) Insert masivo de PVV (uno por bloque). Orden de IDs = orden de combinacioneMapeadas
        const insertedCombinaciones = await LightdataORM.insert({
            db,
            table: "productos_variantes_valores",
            quien: userId,
            data: combinacioneMapeadas,
        });

        // 3) Con esos DID, armar todas las filas para productos_ecommerce
        const ecommerceRows = [];
        for (let i = 0; i < combinaciones.length; i++) {
            const e = combinaciones[i];
            const did_combinacion = insertedCombinaciones[i]; // DID del conjunto de ese bloque
            const tiendas = Array.isArray(e.tiendas) ? e.tiendas : [];

            for (const t of tiendas) {
                ecommerceRows.push({
                    did_producto: didProducto,
                    did_cuenta: isNonEmpty(t.didCuenta) ? t.didCuenta : null,
                    did_producto_variante_valor: did_combinacion,
                    sku: isNonEmpty(t.sku) ? String(t.sku).trim() : null,
                    actualizar: 0,
                    //   sync: isDefined(t.sync) ? number01(t.sync) : 0,
                });
            }
        }

        // 4) Insert masivo de productos_ecommerce (una fila por grupo)
        if (ecommerceRows.length) {
            await LightdataORM.insert({
                db,
                table: "productos_ecommerce",
                quien: userId,
                data: ecommerceRows,
            });
        }
    } else {
        await LightdataORM.insert({
            db,
            table: "productos_variantes_valores",
            quien: userId,
            data: {
                did_producto: didProducto,

                sync: 0,
            },
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
                did_producto: didProducto,
                did_insumo,
                cantidad,
                habilitado: 1,
            };
        });

        await LightdataORM.insert({
            db,
            table: "productos_insumos",
            quien: userId,
            data: insumoData,
        });
    }

    // 🧩 Combos
    if (es_combo) {

        // Validar existencia de productos hijos
        const dids_productos_hijos = productos_hijos.map((ph) => ph.didProducto);
        await LightdataORM.select({
            db,
            table: "productos",
            where: { did: dids_productos_hijos },
            select: "did, es_combo",
            throwIfNotExists: true,
        });

        await LightdataORM.insert({
            db,
            table: "productos_combos",
            quien: userId,
            data: productos_hijos.map((ph) => ({
                did_producto: didProducto,
                did_producto_combo: ph.didProducto,
                cantidad: ph.cantidad,
            })),
        });
    }

    let urlReturn = [];
    if (isNonEmpty(files.length)) {
        for (const file of files) {
            const urlResponse = await axios.post(
                urlSubidaImagenes,
                {
                    file: file,
                    companyId: companyId,
                    clientId: did_cliente,
                    productId: didProducto,
                },
                { headers: { "Content-Type": "application/json" } }
            );
            console.log('urlResponse', urlResponse.data);

            urlReturn.push(urlResponse.data.file.url);
            await LightdataORM.update({
                db,
                table: "productos",
                versionKey: "id",
                where: { id: didProducto },
                data: { imagen: urlReturn[0] },
                quien: userId
            });
        }
    }

    const didsPedidosConEsteProducto = await LightdataORM.select({
        db,
        table: 'pedidos_productos',
        where: { seller_sku: sku },
        select: 'did_pedido'
    });

    const didsOts = await LightdataORM.select({
        db,
        table: 'ordenes_trabajo_pedidos',
        where: { did_pedido: didsPedidosConEsteProducto.map(p => p.did_pedido) },
    });

    for (const ot of didsOts) {
        const pedidosDeLaOT = await LightdataORM.select({
            db,
            table: 'pedidos',
            where: { did_ot: ot.did_orden_trabajo, flex: flex },
            select: 'did'
        });

        for (const pedido of pedidosDeLaOT) {
            const productosNull = await LightdataORM.select({
                db,
                table: 'pedidos_productos',
                where: { did_producto: null, did_pedido: pedido.did },
                select: 'id'
            });

            if (productosNull.length == 0) {
                await LightdataORM.update({
                    db,
                    table: 'ordenes_trabajo',
                    where: { did: ot.did_orden_trabajo },
                    data: { alertada: 0 },
                    quien: userId
                });
            }
        }
    }

    return {
        success: true,
        message: "Producto creado correctamente",
        data: { idProducto: didProducto, files: urlReturn },
    };
}

const setKey = (arr) =>
    Array.from(new Set((Array.isArray(arr) ? arr : []).filter(Number.isInteger)))
        .sort((a, b) => a - b)
        .join(","); 