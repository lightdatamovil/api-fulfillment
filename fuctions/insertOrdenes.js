
const { executeQuery } = require("../dbconfig");
const ORDENES_INSERTADAS = {}; // Almacena las órdenes insertadas
const ESTADOS_CACHE = {}; // Almacena los estados de las órdenes

async function getEstadoOrden(connection, did) {
  if (ESTADOS_CACHE[did]) {
    return ESTADOS_CACHE[did];
  }

  const query = "SELECT status FROM ordenes WHERE did = ?";
  const results = await executeQuery(connection, query, [did]);

  if (results.length > 0) {
    const estado = results[0].status;
    ESTADOS_CACHE[did] = estado;
    return estado;
  }

  return null;
}

async function InsertOrder(connection, data) {
  let didParaUsar = 0;
  let nuevaOrden = false;
  let response = null;
  const number = data.id;
  const idEmpresa = data.idEmpresa; // Obtener idEmpresa del nuevo body

  // Crear una clave única basada en number y idEmpresa
  const keyOrden = `${idEmpresa}_${number}`;

  try {
    // Verificar si ya existe la orden en la base de datos
    const query = "SELECT did FROM ordenes WHERE number = ?";
    const results = await executeQuery(connection, query, [number], true);

    if (results.length > 0) {
      didParaUsar = results[0].did;
      ORDENES_INSERTADAS[keyOrden] = { did: didParaUsar }; // Guardar en la caché
      console.log(`Orden encontrada en BD, did: ${didParaUsar}`);
    } else {
      nuevaOrden = true;
    }

    if (nuevaOrden) {
      const ordenData = {
        id: data.id,
        did: didParaUsar,
        didEnvio: 0,
        didCliente: data.didCliente ?? 0,
        didCuenta: data.didCuenta ?? 0,
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
        seller_sku: data.order_items[0].item.seller_sku ?? 0,
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
        ordenData.seller_sku,
        connection
      );

      response = await orden.insert(ordenData);
      console.log(response, "response de ordenes");

      if (response && response.insertId) {
        didParaUsar = response.insertId;
        ORDENES_INSERTADAS[keyOrden] = { did: didParaUsar }; // Actualizar en la caché
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
        ESTADOS_CACHE[didParaUsar] = data.status; // Actualizar en caché
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

    return {
      insertId: didParaUsar,
      success: true,
      message: "Orden insertada correctamente",
    };
  } catch (error) {
    console.error("Error en InsertOrder:", error.message);
    return { success: false, message: error.message }; // Manejar el error y devolver un valor por defecto
  } finally {
    // Asegúrate de cerrar la conexión en el bloque finally
  }
}

module.exports = InsertOrder;
