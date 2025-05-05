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
const Ordenes_items = require("../controller/fulfillment/ordenes_items");
const OrdenesHistorial = require("../controller/fulfillment/ordenes_historial");

orden.post("/postOrden", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    // Verificar si el estado ya existe
    const estadoRepetido = await Ordenes.esEstadoRepetido(
      connection,
      data.number,
      data.status
    );

    if (estadoRepetido) {
      console.log(
        `Estado repetido para orden ${data.number}, no se inserta ítem ni historial`
      );
      return res.status(200).json({
        estado: false,
        mensaje: "Estado repetido, no se realizaron cambios",
      });
    }

    // Insertar orden
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
      data.seller_sku ?? "",

      connection
    );

    const response = await ordenes.insert();
    console.log(response, "response");
    const didParaUsar = response.insertId || data.did;
    const variation_attribute = JSON.stringify(
      data.items.variation_attributes ?? {}
    );
    // Insertar ítem
    const ordenes_items = new Ordenes_items(
      data.items.did ?? 0,
      didParaUsar,
      data.items.codigo ?? 0,
      data.items.descripcion ?? "",
      data.items.ml_id ?? "",
      data.items.dimensions ?? "",
      data.items.cantidad ?? 0,
      variation_attribute,
      data.items.seller_sku ?? 0,
      data.use_product_id ?? 0,
      data.items.id_variation ?? 0,
      data.items.descargado ?? 0,
      0,
      0,
      0,
      connection
    );

    await ordenes_items.insert();

    // Insertar historial
    const ordenes_historial = new OrdenesHistorial(
      didParaUsar,
      data.status,
      data.quien ?? 0,
      0,
      0,
      connection
    );

    await ordenes_historial.insert();

    // Éxito
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
