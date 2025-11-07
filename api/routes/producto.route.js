import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { createProducto } from "../controller/producto/create_producto.js";
import { updateProducto } from "../controller/producto/update_producto.js";
import { deleteProducto } from "../controller/producto/delete_producto.js";
import { getProductoById } from "../controller/producto/get_producto_by_id.js";
import { getFilteredProductos } from "../controller/producto/get_filtered_productos.js";

const productos = Router();

productos.post(
  "/",
  buildHandlerWrapper({
    requiredParams: ["userId"],
    optional: ["titulo", "posicion", "productos_hijos", "did_curva", "cm3", "alto", "ancho", "profundo", "es_combo", "descripcion", "files", "habilitado", "insumos", "combinaciones", "did_cliente", "sku", "ean"], // el resto es opcional (did_cliente, imagen, es_combo, depositos, insumos, variantesValores, ecommerce, combo, etc.)

    controller: ({ db, req }) => createProducto({ db, req }),
  })
);

productos.put(
  "/:did",
  buildHandlerWrapper({
    requiredParams: ["did"],
    optional: ["did_cliente", "titulo", "descripcion", "habilitado", "es_combo", "posicion", "cm3", "alto", "ancho", "profundo", "files", "sku", "ean", "did_curva", "insumos", "combinaciones", "productos_hijos"],
    controller: ({ db, req }) => updateProducto({ db, req }),
  })
);

productos.delete(
  "/:did",
  buildHandlerWrapper({
    requiredParams: [],
    controller: ({ db, req }) => deleteProducto({ db, req }),
  })
);

productos.get(
  "/:did",
  buildHandlerWrapper({
    requiredParams: ["did"],
    controller: ({ db, req }) => getProductoById({ db, req }),
  })
);

productos.get(
  "/",
  buildHandlerWrapper({
    controller: ({ db, req }) => getFilteredProductos({ db, req }),
  })
);

export default productos;
