import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { getStockActualbyProducto } from "../controller/stock/get_stock_actual.js";
import { ingresoStockMasivo } from "../controller/stock/ingreso_stock_masivo.js";
import { getStockActualIE } from "../controller/stock/get_stock_egreso.js";
import { egresoStockMasivo } from "../controller/stock/egreso_stock_masivo.js";
import { ajusteStockMasivo } from "../controller/stock/ajuste_stock_masivo.js";
import { informeStock } from "../controller/stock/informe_stock.js";
import { informeStockCombinacion } from "../controller/stock/informe_stock_combinacion.js";

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

    controller: ({ db, req }) => getStockActualIE({ db, req }),
  })
);

stock.post(
  "/productos/ingreso",
  buildHandlerWrapper({
    optional: ["did_cliente", "productos", "fecha", "observacion", "did_deposito"],
    controller: ({ db, req }) => ingresoStockMasivo({ db, req }),
  })
);

stock.post(
  "/productos/egreso",
  buildHandlerWrapper({
    requiredParams: ["did"],
    optional: ["did_cliente", "productos", "fecha", "observacion", "did_deposito"],
    controller: ({ db, req }) => egresoStockMasivo({ db, req }),
  })
);

stock.post(
  "/productos/ajuste",
  buildHandlerWrapper({
    optional: ["did_cliente", "productos", "fecha", "observacion", "did_deposito"],
    controller: ({ db, req }) => ajusteStockMasivo({ db, req }),
  })
);

stock.get(
  "/clientes/:did_cliente/informe",
  buildHandlerWrapper({
    controller: ({ db, req }) => informeStock({ db, req }),
  })
);


stock.get(
  "/clientes/:did_cliente/productos/:did_producto/informe",
  buildHandlerWrapper({
    controller: ({ db, req }) => informeStockCombinacion({ db, req }),
  })
);

export default stock;
