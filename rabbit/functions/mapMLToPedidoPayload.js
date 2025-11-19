export function mapMlToPedidoPayload(ml, sellerData, didCliente) {
    const firstItem = ml?.order_items?.[0];
    const variation_attributes = firstItem?.item?.variation_attributes || null;

    // si processOrderMessage enriqueció ml.shipping.receiver_address, viaja acá
    const receiver_address = ml?.shipping?.receiver_address || null;
    //console.log(receiver_address, "receiver_address");
    console.log(sellerData, "dsadasda");


    return {

        did_cliente: didCliente,
        status: ml?.status || "created",
        number: String(ml?.id || ""),
        fecha_venta: ml?.date_closed || new Date().toISOString(),
        buyer_id: ml?.buyer?.id ? String(ml.buyer.id) : "",
        buyer_nickname: ml?.buyer?.nickname ?? "",
        buyer_name: ml?.buyer?.first_name ?? "",
        buyer_last_name: ml?.buyer?.last_name ?? "",
        total_amount: ml?.total_amount ?? 0,
        ml_shipment_id: ml?.shipping?.id ? String(ml.shipping.id) : "",
        ml_id: String(ml?.id || ""),
        ml_pack_id: ml?.pack_id ? String(ml.pack_id) : "",
        site_id: ml?.site_id || "",
        currency_id: ml?.currency_id || "",
        observaciones: "",
        armado: 0,
        descargado: 0,
        quien_armado: 0,

        // Para que createPedido inserte en pedidos_ordenes_direcciones_destino
        ...(receiver_address ? { shipping: { receiver_address } } : {}),

        items: [
            {
                seller_sku: firstItem?.item?.seller_sku ?? "",
                codigo: firstItem?.item?.id ? String(firstItem.item.id) : null,
                descripcion: firstItem?.item?.title ?? "",
                cantidad: Number(firstItem?.quantity || 1),
                variation_attributes,
                id_variacion: firstItem?.item?.variation_id ?? null,
                user_product_id: firstItem?.item?.user_product_id ?? null,
                ml_id: firstItem?.id ? String(firstItem.id) : null,
                dimensions: firstItem?.item?.dimensions || "",
                variacion: null,
                imagen: null,
            },
        ],
    };
}
