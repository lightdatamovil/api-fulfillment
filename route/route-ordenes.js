
const express = require("express");
const orden = express.Router();

const {
  redisClient,
  getConnection,
  getCompanyById,
  getConnectionLocal,
} = require("../dbconfig");

const { logRed } = require("../fuctions/logsCustom");

const StockConsolidado = require("../controller/producto/stock_consolidado");

const Stock = require("../controller/producto/stock");
const MovimientoStock = require("../controller/producto/movimiento_stock");
const Ordenes = require("../controller/fulfillment/ordenes");

orden.post("/InsertOrder", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  try {
const ordenes = new Ordenes(
  data.did ?? 0,
  0,
  data.didCliente ?? 0,
    data.didCuenta ?? 0,
  data.status,
  data.flex,
    data.number,
  data.observaciones,
  data.armado ?? 0,
  data.descargado ?? 0,
    data.fecha_armado ?? null,
    data.fecha_venta,
    data.quien_armado,
    data.ml_shipment_id ?? null,
    data.ml_id ?? "",
    data.ml_pack_id ?? "",
    data.buyer_id ?? "",
    data.buyer_nickname ?? "",
    data.buyer_name ?? "",
    data.buyer_last_name ?? "",
    data.total_amount ?? "",
    data.seller_id ?? "",
  data.quien,
  data.superado ?? 0,
  data.elim ?? 0,
  connection);


 const  response = await ordenes.insert(ordenes);
      console.log(response, "response de ordenes");

      if (response && response.insertId) {
        didParaUsar = response.insertId;
        ORDENES_INSERTADAS[keyOrden] = { did: didParaUsar };
        console.log(`Orden insertada nueva, did: ${didParaUsar}`);
      } else {
        console.log(`Error al insertar orden, no se obtuvo insertId`);
        return { insertId: 0 };
      }
    }

    // Verificar si hay cambio de estado (solo si no es nueva)
    let estadoCambiado = false;
    if (!nuevaOrden && didParaUsar !== 0) {
      const estadoAnterior = await getEstadoOrden(connection, didParaUsar);
      estadoCambiado = estadoAnterior !== data.status;
      if (estadoCambiado) {
        ESTADOS_CACHE[didParaUsar] = data.status; // actualizar en caché
      }
    }

    if (didParaUsar !== 0 && (nuevaOrden || estadoCambiado)) {
      const variation_attribute = JSON.stringify(
        data.order_items[0].item.variation_attributes
      );

      const ordenes_items = new Ordenes_items(
        0,
        didParaUsar,
        0,
        null,
        data.order_items[0].item.title,
        data.order_items[0].item.id,
        data.order_items[0].item.dimensions || "",
        data.order_items[0].quantity,
        variation_attribute,
        data.order_items[0].item.seller_sku ?? 0,
        data.order_items[0].item.user_product_id,
        data.order_items[0].item.variation_id,
        0,
        0,
        0,
        connection
      );

      await ordenes_items.insert();

      const ordenes_historial = new OrdenesHistorial(
        didParaUsar,
        data.status,
        data.quien ?? 0,
        0,
        0,
        connection
      );

      await ordenes_historial.insert();
    } else {
      console.log(
        `Estado repetido para orden ${number}, no se inserta ítem ni historial`
      );
    }

    return { insertId: didParaUsar };
);
    return res.status(200).json({
      estado: true,
      data: response,
    });
  } catch (error) {
    console.error("Error durante la operación:", error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});
orden.get("/", async (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

module.exports = orden;



















async function InsertOrder(connection, data, dataredis) {
  const seller_id = String(data.seller.id);
  const number = String(data.id);
  const keyOrden = `${seller_id}_${number}`;

  let didParaUsar = 0;
  let nuevaOrden = false;
  let response = null;

  try {
    if (ORDENES_INSERTADAS[keyOrden]) {
      didParaUsar = ORDENES_INSERTADAS[keyOrden].did;
      console.log(`Orden encontrada en memoria, did: ${didParaUsar}`);
    } else {
      const query = "SELECT did FROM ordenes WHERE number = ?";
      const results = await executeQuery(connection, query, [number]);

      if (results.length > 0) {
        didParaUsar = results[0].did;
        ORDENES_INSERTADAS[keyOrden] = { did: didParaUsar };
        console.log(`Orden encontrada en BD, did: ${didParaUsar}`);
      } else {
        nuevaOrden = true;
      }
    }

    if (nuevaOrden) {
      const ordenData = {
        id: data.id,
        did: didParaUsar,
        didEnvio: 0,
        didCliente: dataredis.idcliente ?? 0,
        didCuenta: dataredis.idcuenta ?? 0,
        status: data.status,
        flex: 1,
        number: number,
        fecha_venta: data.date_closed,
        observaciones: "",
        armado: 0,
        descargado: 0,
        fecha_armado: null,
        quien_armado: 0,
        ml_shipment_id: data.shipping?.id ? String(data.shipping.id) : "",
        ml_id: String(data.id),
        ml_pack_id: data.pack_id ? String(data.pack_id) : "",
        buyer_id: data.buyer?.id ? String(data.buyer.id) : "",
        buyer_nickname: data.buyer?.nickname ?? "",
        buyer_name: data.buyer?.first_name ?? "",
        buyer_last_name: data.buyer?.last_name ?? "",
        total_amount: data.total_amount ?? 0,
      };

      const orden = new Ordenes(
        ordenData.did,
        ordenData.didEnvio,
        ordenData.didCliente,
        ordenData.didCuenta,
        ordenData.status,
        ordenData.flex,
        ordenData.number,
        ordenData.observaciones,
        ordenData.armado,
        ordenData.descargado,
        ordenData.fecha_armado,
        ordenData.fecha_venta,
        ordenData.quien_armado,
        ordenData.ml_shipment_id,
        ordenData.ml_id,
        ordenData.ml_pack_id,
        ordenData.buyer_id,
        ordenData.buyer_nickname,
        ordenData.buyer_name,
        ordenData.buyer_last_name,
        ordenData.total_amount,
        connection
      );

      response = await orden.insert(ordenData);
      console.log(response, "response de ordenes");

      if (response && response.insertId) {
        didParaUsar = response.insertId;
        ORDENES_INSERTADAS[keyOrden] = { did: didParaUsar };
        console.log(`Orden insertada nueva, did: ${didParaUsar}`);
      } else {
        console.log(`Error al insertar orden, no se obtuvo insertId`);
        return { insertId: 0 };
      }
    }

    // Verificar si hay cambio de estado (solo si no es nueva)
    let estadoCambiado = false;
    if (!nuevaOrden && didParaUsar !== 0) {
      const estadoAnterior = await getEstadoOrden(connection, didParaUsar);
      estadoCambiado = estadoAnterior !== data.status;
      if (estadoCambiado) {
        ESTADOS_CACHE[didParaUsar] = data.status; // actualizar en caché
      }
    }

    if (didParaUsar !== 0 && (nuevaOrden || estadoCambiado)) {
      const variation_attribute = JSON.stringify(
        data.order_items[0].item.variation_attributes
      );

      const ordenes_items = new Ordenes_items(
        0,
        didParaUsar,
        0,
        null,
        data.order_items[0].item.title,
        data.order_items[0].item.id,
        data.order_items[0].item.dimensions || "",
        data.order_items[0].quantity,
        variation_attribute,
        data.order_items[0].item.seller_sku ?? 0,
        data.order_items[0].item.user_product_id,
        data.order_items[0].item.variation_id,
        0,
        0,
        0,
        connection
      );

      await ordenes_items.insert();

      const ordenes_historial = new OrdenesHistorial(
        didParaUsar,
        data.status,
        data.quien ?? 0,
        0,
        0,
        connection
      );

      await ordenes_historial.insert();
    } else {
      console.log(
        `Estado repetido para orden ${number}, no se inserta ítem ni historial`
      );
    }

    return { insertId: didParaUsar };
  } catch (error) {
    console.error("Error en InsertOrder:", error.message);
    return { insertId: 0 }; // Manejar el error y devolver un valor por defecto
  } finally {
    // Asegúrate de cerrar la conexión en el bloque finally
  }
}