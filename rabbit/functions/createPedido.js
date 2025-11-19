import { executeQuery } from "lightdata-tools";
/**
 * @param {any} v
 * @returns {string}
 */
function s(v) {
    return String(v ?? "").trim();
}

/**
 * Convierte a number o null si no es parseable.
 * @param {any} v
 * @returns {number|null}
 */
function n(v) {
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
}

export async function createPedido(db, payload, userId) {
    // ml_id del pedido: nunca null/undefined
    const pedidoMlId = s(payload?.ml_id ?? payload?.number ?? "");
    //console.log(payload, "SDADADASDA");


    // Insert encabezado
    const cols = [
        "status", "flex", "did_cliente", "deadLine", "trabajado", "number", "fecha_venta", "buyer_id", "buyer_nickname",
        "buyer_name", "buyer_last_name", "total_amount", "ml_shipment_id", "ml_id",
        "ml_pack_id", "observaciones", "armado", "descargado",
        "quien_armado", "reference_id", "billing", "quien", "superado", "elim"
    ];
    const ph = cols.map(() => "?");
    const vals = [

        payload.status,
        1,
        payload.did_cliente ?? 0,
        payload.deadline ?? 0,
        0,
        payload.number,
        payload.fecha_venta,
        payload.buyer_id,
        payload.buyer_nickname,
        payload.buyer_name,
        payload.buyer_last_name,
        payload.total_amount,
        payload.ml_shipment_id,
        pedidoMlId,                // <= nunca null
        payload.ml_pack_id,
        payload.observaciones ?? "",
        payload.armado ?? 0,
        payload.descargado ?? 0,
        payload.quien_armado ?? 0,
        payload.reference_id ?? "",
        payload.billing ? JSON.stringify(payload.billing) : null,
        Number(userId ?? 0),
        0,
        0
    ];


    const ins = await executeQuery(
        {
            db,

            query: `INSERT INTO pedidos (${cols.join(",")}) VALUES (${ph.join(",")})`,
            values: vals,

        }
    );
    if (!ins?.insertId) throw new Error("No se pudo insertar pedido");

    const id = ins.insertId;
    await executeQuery({ db, query: `UPDATE pedidos SET  did  = ? WHERE id = ?`, values: [id, id] });
    const did = id;

    // Insert items (dimensions y variacion NUNCA null)
    for (const it of (payload.items || [])) {
        if (!it || Number(it.cantidad) <= 0) continue;

        // ml_id del item con fallback: it.ml_id -> it.codigo -> pedidoMlId
        const mlItemIdFinal = s(it.ml_id ?? it.codigo ?? pedidoMlId ?? "");

        const icol = [
            "did_pedido", "seller_sku", "codigo", "descripcion", "ml_id", "dimensions",
            "did_producto_variante_valor", "id_variacion", "user_product_id", "cantidad", "variation_attributes",
            "imagen", "quien", "superado", "elim"
        ];
        const iph = icol.map(() => "?").join(",");

        const ival = [
            did,
            s(it.seller_sku ?? ""),               // nunca null
            it.codigo ?? null,
            it.descripcion ?? null,
            mlItemIdFinal,                         // nunca null
            s(it.dimensions ?? ""),                // NUNCA null
            s(it.did_producto_variante_valor ?? ""),                 // NUNCA null
            it.id_variacion ?? null,
            it.user_product_id ?? null,
            Number(it.cantidad),
            it.variation_attributes ? JSON.stringify(it.variation_attributes) : null,
            it.imagen ?? null,
            Number(userId ?? 0),
            0,
            0
        ];
        const queryInsert = `INSERT INTO pedidos_productos (${icol.join(",")}) VALUES (${iph})`;

        const insertPedidoProducto = await executeQuery({
            db,
            query: queryInsert,
            values: ival,
        }

        );

        const pedidoProductoId = insertPedidoProducto.insertId;
        await executeQuery({ db, query: `UPDATE pedidos_productos SET did = ? WHERE id = ?`, values: [pedidoProductoId, pedidoProductoId] });
    }

    // === Dirección de destino ML (pedidos_ordenes_direcciones_destino) ===
    // Soporta distintos "shapes" de ML:
    // - payload.shipping.receiver_address.{address_line, zip_code, city.name, state.name, country.id, latitude, longitude, comment}
    // - payload.receiver_address.*  (fallback)
    // - payload.shipping.{receiver_address: {...}} dentro de shipments
    const rx =
        payload?.shipping?.receiver_address ??
        payload?.receiver_address ??
        null;

    // Extra: a veces ML trae ventana horaria en tags o en delivery.*; las dejamos opcionales
    // y con fallback a "" (columnas son NULL por esquema, así que podemos guardar null tranquilamente).
    const horaDesde = payload?.delivery?.schedule?.from ?? null;
    const horaHasta = payload?.delivery?.schedule?.to ?? null;

    // Map a columnas de la tabla
    // (NOTA: 'did' es FK lógica al pedido recién creado)
    if (rx) {
        const calle = s(rx?.street_name ?? rx?.address_line ?? "");
        const numero = s(rx?.street_number ?? rx?.number ?? "");
        const address_line = s(
            rx?.address_line ??
            [calle, numero].filter(Boolean).join(" ") ??
            ""
        );
        const cp = s(rx?.zip_code ?? rx?.zip ?? "");
        const localidad = s(rx.city || "");
        const provincia = s(rx.state || "");
        const pais = s(rx.country || "");
        const latitud = n(rx?.latitude);
        const longitud = n(rx?.longitude);
        const destination_coments = s(
            rx?.comment ??
            payload?.shipping?.comments ??
            payload?.comments ??
            ""
        );

        const dirCols = [
            "did_pedido", "calle", "numero", "address_line", "cp", "localidad", "provincia", "pais",
            "latitud", "longitud", "destination_coments", "hora_desde", "hora_hasta", "prioridad",
            "quien", "superado", "elim"
        ];
        const dirVals = [
            did,
            calle || null,                  // NULL si no vino
            numero || null,
            address_line || null,
            cp || null,
            localidad || null,
            provincia || null,
            pais || null,
            latitud,                        // number | null
            longitud,                       // number | null
            destination_coments || null,
            horaDesde || null,
            horaHasta || null,
            null,                           // prioridad (opcional, dejamos null)
            Number(userId ?? 0),
            0,
            0
        ];
        const dirPh = dirCols.map(() => "?").join(",");

        await executeQuery({
            db,
            query: `INSERT INTO pedidos_ordenes_direcciones_destino (${dirCols.join(",")}) VALUES (${dirPh})`,
            values: dirVals,
        }
        );
    }

    // Historial inicial
    await executeQuery(
        {
            db,
            query: `INSERT INTO pedidos_historial (did_pedido, estado, quien, superado, elim) VALUES (?, ?, ?, 0, 0)`,
            values: [did, payload.status || "created", Number(userId ?? 0)],
        }
    );

    return did;
}
