// functions/mapTNToPedidoPayload.js  (ESM)
export function mapTNToPedidoPayload(tn, sellerData) {
    // 1) Fuente de la dirección de envío (TN puede traerla en shipping_address o en el default del cliente)
    const srcAddr =
        tn?.shipping_address ||
        tn?.customer?.default_address ||
        null;

    // 2) Normalizamos la dirección destino al formato que usa createPedido
    const receiver_address = srcAddr
        ? {
            street_name: srcAddr.address || "",                  // "Larrea"
            street_number: srcAddr.number ? Number(srcAddr.number) : 0, // "449"
            address_line: [srcAddr.address, srcAddr.number].filter(Boolean).join(" ").trim(),
            zip_code: srcAddr.zipcode || "",
            city: srcAddr.city || "",
            state: srcAddr.province || "",
            country: srcAddr.country || "",
            latitude: srcAddr.latitude ?? null,
            longitude: srcAddr.longitude ?? null,
            comment: tn?.note || "", // en tu JSON viene `note`, no `comments`
        }
        : null;

    // 3) Regla: ml_id = number (número visible) | reference_id = id (interno)
    const orderNumber = String(tn?.number ?? "");
    const reference_id = tn?.id != null ? String(tn.id) : "";

    // 4) Billing: tomamos todos los campos "billing_*" de la orden (lo que pediste)
    const billing = {
        billing_name: tn?.billing_name ?? null,
        billing_phone: tn?.billing_phone ?? null,
        billing_address: tn?.billing_address ?? null,
        billing_number: tn?.billing_number ?? null,
        billing_floor: tn?.billing_floor ?? null,
        billing_locality: tn?.billing_locality ?? null,
        billing_zipcode: tn?.billing_zipcode ?? null,
        billing_city: tn?.billing_city ?? null,
        billing_province: tn?.billing_province ?? null,
        billing_country: tn?.billing_country ?? null,
        billing_customer_type: tn?.billing_customer_type ?? null,
        billing_business_name: tn?.billing_business_name ?? null,
        billing_trade_name: tn?.billing_trade_name ?? null,
        billing_state_registration: tn?.billing_state_registration ?? null,
        billing_fiscal_regime: tn?.billing_fiscal_regime ?? null,
        billing_business_activity: tn?.billing_business_activity ?? null,
        billing_invoice_use: tn?.billing_invoice_use ?? null,
        billing_document_type: tn?.billing_document_type ?? null,
    };
    // limpiamos nulls para que sea JSON prolijo
    Object.keys(billing).forEach(k => billing[k] == null && delete billing[k]);

    // 5) Items: mapear TODOS los productos
    const items = (Array.isArray(tn?.products) ? tn.products : []).map(p => ({
        seller_sku: p?.sku ?? "",
        // en TN el identificador de producto suele ser product_id; si no, usamos id del ítem
        codigo: p?.product_id ? String(p.product_id) : p?.id ? String(p.id) : "",
        descripcion: p?.name_without_variants || p?.name || "",
        cantidad: Number(p?.quantity || 1),
        variation_attributes: p?.variant_values || null,
        id_variacion: p?.variant_id ?? null,
        user_product_id: p?.product_id ?? null,
        ml_id: p?.id ? String(p.id) : "", // id de la línea
        dimensions: "",
        variacion: null,
        imagen: p?.image?.src ?? null,
    }));

    return {
        did_cuenta: sellerData?.did_cuenta ?? 0,

        status: tn?.financial_status || tn?.status || "open",
        number: orderNumber,              // ← número visible TN
        ml_id: orderNumber,               // ← **ml_id = number**
        reference_id,                     // ← **reference_id = id**
        fecha_venta: tn?.closed_at || tn?.paid_at || tn?.created_at || new Date().toISOString(),

        buyer_id: tn?.customer?.id ? String(tn.customer.id) : "",
        buyer_nickname: tn?.customer?.email ?? "",
        buyer_name: tn?.customer?.first_name ?? (tn?.customer?.name || "").split(" ").slice(0, -1).join(" "),
        buyer_last_name: tn?.customer?.last_name ?? (tn?.customer?.name || "").split(" ").slice(-1).join(" "),
        total_amount: tn?.total ? Number(tn.total) : 0,

        ml_shipment_id: tn?.shipments?.[0]?.id ? String(tn.shipments[0].id) : "",
        ml_pack_id: "",
        site_id: "TN",
        currency_id: tn?.currency ?? "",
        observaciones: tn?.note || "",
        armado: 0,
        descargado: 0,
        quien_armado: 0,

        billing, // ← JSON válido (si tu INSERT espera string, hacé JSON.stringify(billing) al insertar)

        // ***IMPORTANTE***: para que createPedido inserte destino, debe ir dentro de `shipping`
        ...(receiver_address ? { shipping: { receiver_address } } : {}),

        items,
    };
}
