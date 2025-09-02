import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import { deleteProducto } from "../controller/producto/delete_producto.js";
import mysql2 from "mysql2";
import { getFilteredProductos } from "../controller/producto/get_filtered_productos.js";

const producto = Router();

producto.post("/", verifyToken(jwtSecret), async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa);

  try {
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
      data.largo ?? 0,
      data.ancho ?? 0,
      data.profundo ?? 0,
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
        data.variantes.did,
        productId,
        JSON.stringify(data.variantes.data),
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
          ecommerceItem.did ?? 0,
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
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error,
    });
  } finally {
    connection.end();
  }
});

producto.get("/", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, [], {});

    const { companyId } = req.user;

    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await getFilteredProductos(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end()
  }
});

producto.post("/getProductoById", verifyToken(jwtSecret), async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa);
  const producto = new ProductO1();
  const response = await producto.traerProductoId(connection, data.did);
  return res.status(200).json({
    estado: true,
    data: response,
  });
});
producto.post("/updateProducts", verifyToken(jwtSecret), async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa);
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
producto.post("/updateCombos", verifyToken(jwtSecret), async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa);

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
producto.post("/updateEcommerce", verifyToken(jwtSecret), async (req, res) => {
  const data = req.body;
  const connection = getFFProductionDbConfig(data.idEmpresa);
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
producto.delete("/:productoId", verifyToken(jwtSecret), async (req, res) => {
  let dbConnection;

  try {
    verifyHeaders(req, []);
    verifyAll(req, ['productoId'], {});

    const { companyId } = req.user;
    console.log(companyId, "companyId");


    const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
    console.log(dbConfig, "dbConfig");

    dbConnection = mysql2.createConnection(dbConfig);
    dbConnection.connect();

    const result = await deleteProducto(dbConnection, req);

    res.status(Status.ok).json(result);
  } catch (error) {
    errorHandler(req, res, error);
  } finally {
    if (dbConnection) dbConnection.end();
  }
});

export default producto;
