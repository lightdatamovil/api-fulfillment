import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { getStockActualbyProducto } from "../controller/stock/get_stock_actual.js";
import { addStock } from "../controller/stock/ingreso_stock.js";


const stock = Router();

stock.get(
  "/productos/:did_producto",
  buildHandlerWrapper({
    requiredParams: ["did_producto"],
    controller: ({ db, req }) => getStockActualbyProducto({ db, req }),
  })
);


stock.post(
  "/",
  buildHandlerWrapper({
    requiredParams: ["did"],
    optional: ["did_producto", "cantidad", "did_combinacion", "identificadores_especiales", "did_deposito"],
    controller: ({ db, req }) => addStock({ db, req }),
  })
);

/*
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

export default stock;
