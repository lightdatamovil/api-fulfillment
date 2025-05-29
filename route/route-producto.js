const express = require("express");
const producto = express.Router();

const {
  redisClient,
  getConnection,
  getCompanyById,
  getConnectionLocal,
} = require("../dbconfig");

const { logRed } = require("../fuctions/logsCustom");

const ProductoCombo = require("../controller/producto/productoCombo");
const ProductoDeposito = require("../controller/producto/productoDeposito");
const ProductoEcommerce = require("../controller/producto/productoEcommerce");
const ProductO1 = require("../controller/producto/producto");
const StockConsolidado = require("../controller/stock/stock_consolidado");
const ProductoInsumo = require("../controller/producto/productoInsumo");
const ProductoVariantes = require("../controller/producto/productoVariaciones");

producto.post("/postProducto", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    // Crear nuevo producto
    const producto = new ProductO1(
      data.did ?? 0,
      data.cliente,
      data.sku,
      data.titulo,
      data.ean,
      data.descripcion,
      data.imagen,
      data.habilitado,
      data.esCombo,
      data.posicion ?? "",
      data.cm3 ?? 0,
      data.quien,
      data.superado ?? 0,
      data.elim ?? 0,
      connection
    );

    const productoResult = await producto.insert();

    if (productoResult.estado === false) {
      return res
        .status(400)
        .json({ status: false, message: productoResult.message });
    }

    let productId = productoResult.insertId;
    if (
      data.did != 0 &&
      data.did != null &&
      data.did != undefined &&
      data.did != ""
    ) {
      productId = data.did;
    }

    const dIdProducto = data.did;

    // Borrar los valores que ya no están
    const helperValor = new ProductoCombo();
    const didsActuales = Array.isArray(data.combos)
      ? data.combos
          .filter((v) => v && typeof v.did === "number")
          .map((v) => v.did)
          .filter((d) => d > 0)
      : [];

    await helperValor.deleteMissing(connection, dIdProducto, didsActuales);

    if (data.combos && Array.isArray(data.combos)) {
      for (const item of data.combos) {
        const productoCombo = new ProductoCombo(
          item.did ?? 0, // did producto combo
          productId, // id producto padre (el nuevo producto insertado)
          item.did, // id del producto hijo (parte del combo)
          parseInt(item.cantidad), // cantidad de ese producto en el combo
          null, // data.combo ya no es necesario acá
          data.quien,
          0,
          0,
          connection
        );

        await productoCombo.insert();
      }
    }
    const helperInsumo = new ProductoInsumo();
    const didsInsumosActuales = Array.isArray(data.insumos)
      ? data.insumos
          .filter((v) => v && typeof v.did === "number")
          .map((v) => v.did)
          .filter((d) => d > 0)
      : [];

    await helperInsumo.deleteMissing(
      connection,
      dIdProducto,
      didsInsumosActuales
    );

    if (data.insumos && Array.isArray(data.insumos)) {
      for (const ins of data.insumos) {
        const insumo = new ProductoInsumo(
          ins.did, // did producto combo
          productId, // id producto padre (el nuevo producto insertado)
          ins.did, // id del producto hijo (parte del combo)
          parseFloat(ins.cantidad), // cantidad de ese producto en el combo
          ins.habilitado ?? 1, // data.combo ya no es necesario acá
          data.quien,
          0,
          0,
          connection
        );

        await insumo.insert();
      }
    }
    const helperVariante = new ProductoVariantes();
    const variantesActuales = Array.isArray(data.variantes)
      ? data.variantes
          .filter((v) => v && v.data?.did)
          .map((v) => v.data.did)
          .filter((d) => d > 0)
      : [];

    await helperVariante.deleteMissing(
      connection,
      dIdProducto,
      variantesActuales
    );

    if (data.variantes) {
      const varianteA = new ProductoVariantes(
        data.variante.did,
        productId,
        JSON.stringify(data.variante.data), // 👈 transformás el objeto a string
        data.quien,
        0,
        0,
        connection
      );

      const resultsVariante = await varianteA.insert();
      const variantId = resultsVariante.insertId;
    }

    const helperEcommerce = new ProductoEcommerce();

    const ecommerceActuales = Array.isArray(data.ecommerce)
      ? data.ecommerce
          .filter((v) => v && typeof v.did === "number")
          .map((v) => v.did)
          .filter((d) => d > 0)
      : [];

    await helperEcommerce.deleteMissing(
      connection,
      dIdProducto,
      ecommerceActuales
    );
    if (data.ecommerce && Array.isArray(data.ecommerce)) {
      for (const ecommerceItem of data.ecommerce) {
        const productoEcommerce = new ProductoEcommerce(
          ecommerceItem.did ?? 0, // Usamos el did del ecommerceItem aquí
          productId,
          ecommerceItem.didCuenta ?? 0,
          ecommerceItem.flex ?? 0,
          JSON.stringify(ecommerceItem.variante) ?? "",
          ecommerceItem.sku,
          ecommerceItem.ean ?? "",
          ecommerceItem.url ?? "",
          ecommerceItem.actualizar ?? 0,
          data.quien,
          0,
          0,
          connection
        );
        await productoEcommerce.insert();
      }
    }
    return res.status(200).json({
      estado: true,
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

producto.post("/getProductos", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const producto = new ProductO1();

  try {
    const response = await producto.traerProductos(connection, {
      pagina: data.pagina || 1,
      cantidad: data.cantidad || 10,
      titulo: data.titulo || "",
      sku: data.sku || "",
      habilitado: data.habilitado || "",
      esCombo: data.esCombo || "",
      cliente: data.cliente || "",
      ean: data.ean || "",
    });

    return res.status(200).json({
      estado: true,
      totalRegistros: response.totalRegistros,
      totalPaginas: response.totalPaginas,
      pagina: response.pagina,
      cantidad: response.cantidad,
      data: response.data,
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

producto.post("/getProductosById", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const producto = new ProductO1();
  const response = await producto.traerProductoId(connection, data.did);
  return res.status(200).json({
    estado: true,
    productos: response,
  });
});
producto.post("/updateProducts", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const producto = new ProductO1(
    data.did ?? 0,
    data.cliente,
    data.sku,
    data.titulo,
    data.descripcion,
    data.imagen,
    data.habilitado,
    data.esCombo,
    data.posicion ?? "",
    data.quien,
    data.superado ?? 0,
    data.elim ?? 0,
    connection
  );
  const response = await producto.checkAndUpdateDidProducto(
    connection,
    data.did
  );
  return res.status(200).json({
    estado: true,
    productos: response,
  });
});
producto.post("/updateCombos", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  const combo = new ProductoCombo(
    data.did ?? 0,
    data.did,
    data.cantidad ?? 0,
    data.combo
  );
  await combo.checkAndUpdateDidProductoCombo(connection);

  return res.status(200).json({
    estado: true,
  });
});
producto.post("/updateEcommerce", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  for (const ecommerceItem of data.ecommerce) {
    const productoEcommerce = new ProductoEcommerce(
      data.did ?? 0,
      data.did,
      data.didVariante ?? 0,
      ecommerceItem.tienda,

      ecommerceItem.link,
      ecommerceItem.habilitado,
      ecommerceItem.sync,
      ecommerceItem.sku,
      data.quien,
      0,
      0,
      connection
    );
    await productoEcommerce.checkAndUpdateDidProductoEcommerce(connection);
  }
  return res.status(200).json({
    estado: true,
  });
});

producto.post("/updateDepositos", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  for (const deposito of data.depositos) {
    const productoDeposito = new ProductoDeposito(
      deposito.did ?? 0,
      data.did ?? productoResult.insertId,
      deposito.did,
      deposito.habilitado // habilitado
    );
    // console.log(productoDeposito, "productoDeposito");

    await productoDeposito.checkAndUpdateDidProductoDeposito(connection);
  }
  return res.status(200).json({
    estado: true,
  });
});
producto.post("/getProducts", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);
  const producto = new ProductO1();
  const response = await producto.traerProductos(connection, data);
  return res.status(200).json({
    estado: true,
    productos: response,
  });
});

producto.get("/", async (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

producto.post("/ALGUNAS COSAS VIEJAS DE PRODUCTO ", async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    // Crear nuevo producto
    const producto = new ProductO1(
      data.did ?? 0,
      data.cliente,
      data.sku,
      data.ean,
      data.titulo,
      data.descripcion,
      data.imagen,
      data.habilitado,
      data.esCombo,
      data.posicion ?? "",
      data.quien,
      data.superado ?? 0,
      data.elim ?? 0,
      connection
    );

    const productoResult = await producto.insert();

    const productId = productoResult.insertId;

    // Procesar combos
    if (data.combos && Array.isArray(data.combos)) {
      for (const item of data.combos) {
        const productoCombo = new ProductoCombo(
          data.did ?? 0, // did producto combo
          productId, // id producto padre (el nuevo producto insertado)
          item.did, // id del producto hijo (parte del combo)
          parseInt(item.cantidad), // cantidad de ese producto en el combo
          null, // data.combo ya no es necesario acá
          data.quien,
          0,
          0,
          connection
        );

        await productoCombo.insert();
      }
    }

    if (data.insumos && Array.isArray(data.insumos)) {
      for (const ins of data.insumos) {
        const insumo = new ProductoInsumo(
          0, // did producto combo
          productId, // id producto padre (el nuevo producto insertado)
          ins.did, // id del producto hijo (parte del combo)
          parseFloat(ins.cantidad), // cantidad de ese producto en el combo
          ins.habilitado ?? 1, // data.combo ya no es necesario acá
          data.quien,
          0,
          0,
          connection
        );

        await insumo.insert();
      }
    }

    if (data.variantes && Array.isArray(data.variantes)) {
      for (const variante of data.variantes) {
        const varianteA = new ProductoVariantes(
          0,
          productId,

          variante.data,
          data.quien,
          0,
          0,

          connection
        );
        //    console.log(varianteA, "productoDeposito");

        const resultsVariante = await varianteA.insert();
        const variantId = resultsVariante.insertId;
      }
    }
    /*  const stockConsolidado = new StockConsolidado(
          data.did ?? 0, // did se genera automáticamente
          productId,
          variantId, // didVariante (puede ser 0 si no se relaciona con una variante específica)
          variante.cantidad, // Asignar la cantidad total
          data.quien,
          0,
          0,
          connection
        );

        if (data.ecommerce && Array.isArray(data.ecommerce)) {
          for (const ecommerceItem of data.ecommerce) {
            const productoEcommerce = new ProductoEcommerce(
              data.did ?? 0,
              productoResult.insertId,
              variantId ?? 0,
              ecommerceItem.tienda,

              ecommerceItem.link,
              ecommerceItem.habilitado,
              ecommerceItem.sync,
              ecommerceItem.sku,
              data.quien,
              0,
              0,
              connection
            );
            await productoEcommerce.insert();
          }
        }

        await stockConsolidado.insert();
      }
    }

    // Procesar depósitos
    if (data.depositos && Array.isArray(data.depositos)) {
      for (const deposito of data.depositos) {
        const productoDeposito = new ProductoDeposito(
          deposito.did ?? 0,
          data.did ?? productoResult.insertId,
          deposito.did,

          deposito.habilitado, // habilitado
          data.quien,
          0,
          0,
          connection
        );
        console.log(productoDeposito, "productoDeposito");

        await productoDeposito.insert();
      }
    }
*/
    // Procesar ecommerce

    return res.status(200).json({
      estado: true,
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

module.exports = producto;
