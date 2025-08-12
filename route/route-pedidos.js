import { Router } from "express"
import verificarToken from "../middleware/token"
import InsertOrder from "../fuctions/insertOrdenes"
import Pedidos from "../controller/pedido/pedidos"
import Pedidos_items from "../controller/pedido/pedidos_items"
import pedidoHistorial from "../controller/pedido/pedidos_historial"
import { getFFProductionDbConfig } from "lightdata-tools"
import { hostFulFillement, portFulFillement } from "../db"

const pedido = Router()

pedido.post("/postPedido", verificarToken, async (req, res) => {
  const data = req.body
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

  try {
    const estadoRepetido = await Ordenes.esEstadoRepetido(connection, data.number, data.status)

    if (estadoRepetido) {
      return res.status(200).json({
        estado: false,
        mensaje: "Estado repetido, no se realizaron cambios",
      })
    }
    const ordenes = new Pedidos(
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
    )

    const response = await ordenes.insert()
    const didParaUsar = response.insertId || data.did

    if (Array.isArray(data.items) && data.items.length > 0) {
      for (const item of data.items) {
        const variation_attribute = JSON.stringify(item.variation_attributes ?? {})

        const ordenes_items = new Pedidos_items(
          item.did ?? 0,
          didParaUsar,
          item.codigo ?? 0,
          item.imagen ?? "",
          item.descripcion ?? "",
          item.ml_id ?? "",
          item.dimensions ?? "",
          item.cantidad ?? 0,
          variation_attribute,
          item.seller_sku ?? 0,
          data.use_product_id ?? 0,
          item.id_variation ?? 0,
          item.descargado ?? 0,

          0,
          0,
          connection
        )

        await ordenes_items.insert()
      }
    }

    const pedidos_historial = new pedidoHistorial(didParaUsar, data.status, data.quien ?? 0, 0, 0, connection)

    await pedidos_historial.insert()

    return res.status(200).json({
      estado: true,
      data: response,
    })
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    })
  } finally {
    connection.end()
  }
})
pedido.post("/postOrden2", async (req, res) => {
  const data = req.body
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

  try {
    const result = await InsertOrder(connection, data)

    if (result.success == true) {
      return res.status(200).json({
        estado: true,
        data: result,
      })
    } else {
      return res.status(400).json({
        estado: false,
        mensaje: result.message,
      })
    }
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    })
  } finally {
    connection.end()
  }
})

pedido.post("/PostsubidaMasiva", verificarToken, async (req, res) => {
  const data = req.body
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const estadoRepetido = await Ordenes.esEstadoRepetido(connection, data.numero_venta, "pendiente")

  if (estadoRepetido) {
    return res.status(200).json({
      estado: false,
      mensaje: "Estado repetido, no se realizaron cambios",
    })
  }

  try {
    const ordenes = new Ordenes(
      0,
      0,
      data.codigoCliente ?? 0,
      0,
      "pendiente", // status fijo
      0, // flex
      data.numero_venta ?? "",
      data.observaciones ?? "",
      0, // armado
      0, // descargado
      null, // fecha armado
      data.fecha_venta ?? null,
      0, // quien_armado
      data.id_envio ?? null,
      "",
      "", // ml_id, ml_pack_id
      "", // buyer_id
      "", // buyer_nickname
      data.nombre ?? "",
      data.apellido ?? "",
      data.total ?? "",
      "", // seller_sku
      connection
    )

    const response = await ordenes.insert()
    const didOrden = response.insertId

    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        const ordenes_items = new Ordenes_items(
          0,
          didOrden,
          0,
          "",
          "", // descripción
          "", // ml_id
          "", // dimensiones
          item.cantidad ?? 0,
          "", // variation_attributes
          item.seller_sku ?? "",
          0, // use_product_id
          0, // id_variation
          0,
          0,
          0,

          connection
        )

        await ordenes_items.insert()
      }
    }

    return res.status(200).json({
      estado: true,
      data: response,
    })
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    })
  } finally {
    connection.end()
  }
})

pedido.post("/getPedidos", async (req, res) => {
  const data = req.body
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const pedidos = new Pedidos()

  try {
    const response = await pedidos.getTodasLasOrdenes(connection, data.pagina, data.cantidad, data)

    return res.status(200).json({
      estado: true,
      message: "Pedidos obtenidas correctamente",
      totalRegistros: response.totalRegistros,
      totalPaginas: response.totalPaginas,
      pagina: response.pagina,
      cantidad: response.cantidad,
      data: response.data,
    })
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    })
  } finally {
    connection.end()
  }
})

pedido.post("/getPedidoById", async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
  const pedidos = new Pedidos();
  try {
    const response = await pedidos.getOrdenPorId(connection, data.did);
    return res.status(200).json({
      estado: true,

      data: response["pedido"],
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});
pedido.post("/deletePedido", async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

  try {
    const orden = new Ordenes();
    const response = await orden.delete(connection, data.did);
    return res.status(200).json({
      estado: response.estado !== undefined ? response.estado : false,
      message: response.message || response,
    });
  } catch (error) {
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

export default pedido
