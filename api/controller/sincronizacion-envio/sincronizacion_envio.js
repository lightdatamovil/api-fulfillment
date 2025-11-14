import axios from "axios";
import { LightdataORM } from "lightdata-tools";

export async function sincronizacionEnvio({ db, req }) {
    const { did_pedido, didEmpresa } = req.body;
    const { userId, companyId } = req.user;

    // ---------------------------
    // CARGO PEDIDO
    // ---------------------------
    const pedidoS = await LightdataORM.select({
        db,
        table: "pedidos",
        where: { did: did_pedido, elim: 0 },
        throwIfNotExists: true,
    });

    const pedido = pedidoS[0];

    const pedidoProductos = await LightdataORM.select({
        db,
        table: "pedidos_productos",
        where: { did_pedido: did_pedido, elim: 0 },
    });

    const pedidoDirecciones = await LightdataORM.select({
        db,
        table: "pedidos_ordenes_direcciones_destino",
        where: { did_pedido: did_pedido, elim: 0 },
    });

    const dir = pedidoDirecciones[0];

    // ---------------------------
    // ARMAR ITEMS PARA ENVÍO
    // ---------------------------
    const enviosItems = pedidoProductos.map(p => ({
        sku: p.seller_sku,
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        ml_id: p.ml_id,
        codigo: p.codigo
    }));

    // ---------------------------
    // PAYLOAD BASE DESDE BD
    // ---------------------------
    let payload = {
        idEmpresa: didEmpresa,
        didCuenta: pedido.seller_id ?? 0,
        didCliente: pedido.did_cliente,

        flex: pedido.flex,
        didDeposito: 1,
        ff: 0,
        ia: 0,

        didServicio: 1,
        peso: 1,
        volumen: 0,
        bultos: 1,
        valor_declarado: pedido.total_amount ?? 0,
        monto_total_a_cobrar: 0,

        fecha_venta: pedido.fecha_venta,
        lote: "mlia",
        estado: 7,
        operador: "envioFF",

        enviosObservaciones: {
            observacion: pedido.observaciones ?? ""
        },

        enviosDireccionesDestino: {
            calle: dir?.calle ?? "",
            numero: dir?.numero ?? "",
            cp: dir?.cp ?? "",
            localidad: dir?.localidad ?? "",
            provincia: dir?.provincia ?? "",
            pais: dir?.pais ?? "1",
        },

        enviosItems
    };

    // ---------------------------
    // FLEX = 1 → Agrego ML
    // ---------------------------
    if (pedido.flex == 1) {
        payload = {
            ...payload,
            ml_shipment_id: pedido.ml_shipment_id,
            ml_venta_id: pedido.ml_id,
            ml_pack_id: pedido.ml_pack_id,
            tracking_number: pedido.ml_shipment_id,
        };
    }

    // ---------------------------
    // LLAMADA AXIOS AL ENDPOINT
    // ---------------------------
    const body = { data: payload };



    console.log("Payload final:", payload);



    const response = await axios.post(
        "https://altaenvios.lightdata.com.ar/api/altaenvio",
        body,
        {
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    return response.data;
}
