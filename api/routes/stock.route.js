import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { getStockActualbyProducto } from "../controller/stock/get_stock_actual.js";
import { ingresoStock } from "../controller/stock/ingreso_stock_masivo.js";
import { ajusteStock } from "../controller/stock/ajuste_stock.js";
import { egresoStock } from "../controller/stock/egreso_stock.js";
import { getStockActualIE } from "../controller/stock/get_stock_egreso.js";



const stock = Router();

stock.get(
  "/productos/:did_producto",
  buildHandlerWrapper({
    requiredParams: ["did_producto"],
    controller: ({ db, req }) => getStockActualbyProducto({ db, req }),
  })
);

stock.get(
  "/productos/stockIE/:did_producto",
  buildHandlerWrapper({
    requiredParams: ["did_producto"],
    controller: ({ db, req }) => getStockActualIE({ db, req }),
  })
);

stock.post(
  "/productos/ingreso",
  buildHandlerWrapper({
    optional: ["did_cliente", "productos", "fecha", "observacion", "did_deposito"],
    controller: ({ db, req }) => ingresoStock({ db, req }),
  })
);

stock.post(
  "/productos/egreso",
  buildHandlerWrapper({
    requiredParams: ["did"],
    optional: ["did_cliente", "productos", "fecha", "observacion", "did_deposito"],
    controller: ({ db, req }) => egresoStock({ db, req }),
  })
);

stock.put(
  "/productos/ajuste",
  buildHandlerWrapper({
    optional: ["did_cliente", "productos", "fecha", "observacion", "did_deposito"],
    controller: ({ db, req }) => ajusteStock({ db, req }),
  })
);

/*



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
