const express = require("express")
const orden = express.Router()

const multer = require("multer")
const xlsx = require("xlsx")
const fs = require("fs")

const { getConnectionLocal } = require("../dbconfig")

const Ordenes = require("../controller/orden/ordenes")
const Ordenes_items = require("../controller/orden/ordenes_items")
const OrdenesHistorial = require("../controller/orden/ordenes_historial")
const verificarToken = require("../middleware/token")
const InsertOrder = require("../fuctions/insertOrdenes")

orden.post("/postOrden", verificarToken, async (req, res) => {
  const data = req.body
  const connection = await getConnectionLocal(data.idEmpresa)

  try {
    // Verificar si el estado ya existe
    const estadoRepetido = await Ordenes.esEstadoRepetido(connection, data.number, data.status)

    if (estadoRepetido) {
      console.log(`Estado repetido para orden ${data.number}, no se inserta ítem ni historial`)
      return res.status(200).json({
        estado: false,
        mensaje: "Estado repetido, no se realizaron cambios",
      })
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
    )

    const response = await ordenes.insert()
    console.log(response, "response")
    const didParaUsar = response.insertId || data.did

    // Insertar ítems
    if (Array.isArray(data.items) && data.items.length > 0) {
      for (const item of data.items) {
        const variation_attribute = JSON.stringify(item.variation_attributes ?? {})

        const ordenes_items = new Ordenes_items(
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

    // Insertar historial
    const ordenes_historial = new OrdenesHistorial(didParaUsar, data.status, data.quien ?? 0, 0, 0, connection)

    await ordenes_historial.insert()

    // Éxito
    return res.status(200).json({
      estado: true,
      data: response,
    })
  } catch (error) {
    console.error("Error durante la operación:", error)
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    })
  } finally {
    connection.end()
  }
})
orden.post("/postOrden2", async (req, res) => {
  const data = req.body
  const connection = await getConnectionLocal(data.idEmpresa)

  try {
    // Verificar si el estado ya existe

    const result = await InsertOrder(connection, data)
    // Insertar orden

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
    console.error("Error durante la operación:", error)
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    })
  } finally {
    connection.end()
  }
})

const upload = multer({ dest: "uploads/" })

orden.post("/importExcelOrden", upload.single("file"), async (req, res) => {
  const filePath = req.file.path
  const workbook = xlsx.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName])

  try {
    for (const row of rows) {
      const connection = await getConnectionLocal(req.body.idEmpresa)

      try {
        const estadoRepetido = await Ordenes.esEstadoRepetido(connection, row.number, row.status)

        if (estadoRepetido) {
          console.log(`Estado repetido para orden ${row.number}, se omite`)
          connection.end()
          continue
        }

        const ordenes = new Ordenes(
          row.did ?? 0,
          0,
          row.didCliente ?? 0,
          row.didCuenta ?? 0,
          row.status,
          row.flex,
          row.number,
          row.observaciones,
          row.armado ?? 0,
          row.descargado ?? 0,
          row.fecha_armado ?? null,
          row.fecha_venta,
          row.quien_armado,
          row.ml_shipment_id ?? null,
          row.ml_id ?? "",
          row.ml_pack_id ?? "",
          row.buyer_id ?? "",
          row.buyer_nickname ?? "",
          row.buyer_name ?? "",
          row.buyer_last_name ?? "",
          row.total_amount ?? "",
          row.seller_sku ?? "",
          connection
        )

        const response = await ordenes.insert()
        const didParaUsar = response.insertId || row.did

        // Insertar ítem
        const variation_attribute = row.variation_attributes ? JSON.stringify(JSON.parse(row.variation_attributes)) : "{}"

        const ordenes_items = new Ordenes_items(
          row.did ?? 0,
          didParaUsar,
          row.codigo ?? 0,
          row.descripcion ?? "",
          row.ml_id_item ?? "",
          row.dimensions ?? "",
          row.cantidad ?? 0,
          variation_attribute,
          row.seller_sku ?? 0,
          row.use_product_id ?? 0,
          row.id_variation ?? 0,
          row.descargado_item ?? 0,
          0,
          0,
          0,
          connection
        )

        await ordenes_items.insert()

        // Insertar historial
        const ordenes_historial = new OrdenesHistorial(didParaUsar, row.status, row.quien ?? 0, 0, 0, connection)

        await ordenes_historial.insert()
      } catch (error) {
        console.error("Error procesando fila:", error)
      } finally {
        connection.end()
      }
    }

    fs.unlinkSync(filePath) // borrar el archivo temporal
    return res.status(200).json({ estado: true, mensaje: "Órdenes importadas correctamente" })
  } catch (error) {
    console.error("Error en el importador:", error)
    return res.status(500).json({ estado: false, error: error.message })
  }
})

orden.post("/PostsubidaMasiva", verificarToken, async (req, res) => {
  const data = req.body
  const connection = await getConnectionLocal(data.idEmpresa)
  const estadoRepetido = await Ordenes.esEstadoRepetido(connection, data.numero_venta, "pendiente")

  if (estadoRepetido) {
    console.log(`Estado repetido para orden ${data.number}, no se inserta ítem ni historial`)
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

    const ordenes_historial = new OrdenesHistorial(didOrden, "pendiente", data.quien ?? 0, 0, 0, connection)

    await ordenes_historial.insert()

    return res.status(200).json({
      estado: true,
      data: response,
    })
  } catch (error) {
    console.error("Error al importar orden desde JSON:", error)
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    })
  } finally {
    connection.end()
  }
})

orden.post("/getOrdenes", async (req, res) => {
  const data = req.body
  const connection = await getConnectionLocal(data.idEmpresa)
  const ordenes = new Ordenes()

  try {
    const response = await ordenes.getTodasLasOrdenes(connection, data.pagina, data.cantidad, data)

    return res.status(200).json({
      estado: true,
      message: "Órdenes obtenidas correctamente",
      totalRegistros: response.totalRegistros,
      totalPaginas: response.totalPaginas,
      pagina: response.pagina,
      cantidad: response.cantidad,
      data: response.data,
    })
  } catch (error) {
    console.error("Error durante la operación:", error)
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    })
  } finally {
    connection.end()
  }
})

orden.post("/getOrdenById", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const ordenes = new Ordenes();
  try {
    const response = await ordenes.getOrdenPorId(connection, data.did);
    return res.status(200).json({
      estado: true,

      data: response["orden"],
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
  })
})

module.exports = orden
