// rutas/productos.routes.js
import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

import { createProducto } from "../controller/producto/create_producto.js";
import { updateProducto } from "../controller/producto/update_producto.js";
import { deleteProducto } from "../controller/producto/delete_producto.js";
import { getProductoById } from "../controller/producto/get_producto_by_id.js";
import { getFilteredProductos } from "../controller/producto/get_filtered_productos.js";

const productos = Router();

// POST /productos  (crear producto / combo)
productos.post(
  "/",
  buildHandlerWrapper({
    requiredParams: ["userId"],
    optional: ["titulo", "posicion", "combos", "did_curva", "cm3", "alto", "ancho", "profundo", "es_combo", "descripcion", "imagen", "habilitado", "insumos", "ecommerce", "did_cliente", "sku", "ean"], // el resto es opcional (did_cliente, imagen, es_combo, depositos, insumos, variantesValores, ecommerce, combo, etc.)

    controller: async ({ db, req }) => {
      const result = await createProducto(db, req);
      return result;
    },
  })
);

// PUT /productos/:did  (versionado de producto / combo)
productos.put(
  "/:did",
  buildHandlerWrapper({
    requiredParams: ["did"],
    optional: ["titulo", "posicion", "cm3", "alto", "ancho", "profundo", "es_combo", "combo", "descripcion", "imagen", "habilitado"
      , "insumos", "ecommerce", "did_cliente"],
    controller: async ({ db, req }) => {
      // Pasamos el DID de params → body para el controlador
      req.body.did = Number(req.params.did);
      const result = await updateProducto(db, req);
      return result;
    },
  })
);

// DELETE /productos/:did  (soft-delete)
productos.delete(
  "/:did",
  buildHandlerWrapper({
    requiredParams: [],
    controller: async ({ db, req }) => {
      // Pasamos el DID de params → body para el controlador
      req.body.did = Number(req.params.did);
      const result = await deleteProducto(db, req);
      return result;
    },
  })
);

// GET /productos/:did  (detalle por DID)
productos.get(
  "/:did",
  buildHandlerWrapper({
    requiredParams: ["did"],
    controller: async ({ db, req }) => {
      const result = await getProductoById(db, req);
      return result;
    },
  })
);

// GET /productos  (listado filtrado/paginado)
productos.get(
  "/",
  buildHandlerWrapper({
    controller: async ({ db, req }) => {
      const result = await getFilteredProductos(db, req);
      return result;
    },
  })
);

export default productos;
