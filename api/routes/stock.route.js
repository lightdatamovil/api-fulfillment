import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { getStockActualbyProducto } from "../controller/stock/get_stock_actual_producto.js";

const productos = Router();

productos.get(
  "/:did_producto",
  buildHandlerWrapper({
    requiredParams: ["did_producto"],
    controller: ({ db, req }) => getStockActualbyProducto({ db, req }),
  })
);

/*
productos.put(
  "/:did",
  buildHandlerWrapper({
    requiredParams: ["did"],
    optional: ["did_cliente", "titulo", "descripcion", "habilitado", "es_combo", "posicion", "cm3", "alto", "ancho", "profundo", "combos", "files", "sku", "ean", "did_curva", "insumos", "ecommerce"],
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


*/

export default productos;
