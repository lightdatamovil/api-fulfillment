import { buildObservacionesTN } from "./buildObservacionesTN";
import { normalizeTNReceiverAddress } from "./normalizeTNReceiverAddress";

export function mapTNToPedidoPayload(orderTN, sellerDataLike) {
    const didCuenta = Number(
        sellerDataLike?.did_cuenta ?? sellerDataLike?.idempresa ?? 0
    );
    const sellerId = String(
        sellerDataLike?.seller_id ?? orderTN?.store_id ?? ""
    );

    const buyerId = orderTN?.customer?.id ?? "";
    const buyerName =
        orderTN?.shipping_address?.name ?? orderTN?.customer?.name ?? "";

    const fechaVenta = orderTN?.created_at
        ? new Date(orderTN.created_at)
        : new Date();

    const totalAmount = Number(orderTN?.total ?? 0);

    const itemsTN = Array.isArray(orderTN?.products) ? orderTN.products : [];
    const items = itemsTN.map((p) => {
        const mlItemIdFinal = String(p?.id ?? "");
        const fallbackSku = p?.sku ? String(p.sku) : mlItemIdFinal || "";

        let imgUrl = null;
        if (p?.image) {
            if (typeof p.image === "string") imgUrl = p.image;
            else if (typeof p.image === "object") imgUrl = p.image.src || p.image.url || null;
        }

        return {
            seller_sku: String(p?.sku ?? ""),                    // NOT NULL
            codigo: String(p?.sku ?? mlItemIdFinal ?? ""),       // NOT NULL
            descripcion: String(p?.name ?? ""),                  // NOT NULL
            ml_id: String(mlItemIdFinal ?? ""),                  // NOT NULL
            dimensions: "",                                      // NOT NULL
            variacion: p?.variant_id ? String(p.variant_id) : "",// NOT NULL
            id_variacion: p?.variant_id ?? null,
            user_product_id: String(p?.id ?? fallbackSku ?? ""), // NOT NULL
            cantidad: Number(p?.quantity ?? 1),
            variation_attributes: null,
            imagen: imgUrl,
        };
    });

    const status = String(orderTN?.payment_status ?? orderTN?.status ?? "created");

    const envioId =
        orderTN?.shipping_tracking_number || orderTN?.shipping_option_code || "";

    // 🔹 Dirección normalizada para createPedido
    const receiver_address = normalizeTNReceiverAddress(orderTN);

    return {
        did_cuenta: didCuenta,
        status,
        number: String(orderTN?.id ?? orderTN?.number ?? ""),
        fecha_venta: fechaVenta,
        buyer_id: String(buyerId ?? ""),
        buyer_nickname: "",
        buyer_name: String(buyerName ?? ""),
        buyer_last_name: "",
        total_amount: totalAmount,
        ml_shipment_id: String(envioId ?? ""),
        ml_id: String(orderTN?.id ?? ""), // NOT NULL
        ml_pack_id: "",
        observaciones: buildObservacionesTN(orderTN),
        armado: 0,
        descargado: 0,
        quien_armado: 0,
        quien: Number(sellerDataLike?.quien ?? 0),

        // ⬇️ Esto permite que createPedido inserte en pedidos_ordenes_direcciones_destino
        ...(receiver_address ? { shipping: { receiver_address } } : {}),

        items,
        seller_id: sellerId,
    };
}
