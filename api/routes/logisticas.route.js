import { Router } from "express";
import { createlogistica } from "../controller/logistica/create_logistica.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { getlogisticaById } from "../controller/logistica/get_logsitica_by_id.js";
import { deleteLogistica } from "../controller/logistica/delete_logistica.js";
import { editLogistica } from "../controller/logistica/edit_logistica.js";
import { getFilteredLogisticas } from "../controller/logistica/get_filtered_logistica.js";

const logisticas = Router();

logisticas.post(
  '/',
  buildHandlerWrapper({
    required: ['nombre', 'sync', 'codigo', 'direcciones', 'habilitado'],
    optional: ['codigoSync'],
    controller: ({ db, req }) => createlogistica({ db, req }),
  })
);

logisticas.get(
  '/:logisticaDid',
  buildHandlerWrapper({
    requiredParams: ['logisticaDid'],
    controller: ({ db, req }) => getlogisticaById({ db, req }),
  })
);

logisticas.delete(
  '/:logisticaDid',
  buildHandlerWrapper({
    requiredParams: ['logisticaDid'],
    controller: ({ db, req }) => deleteLogistica({ db, req }),
  })
);

logisticas.put(
  '/:logisticaDid',
  buildHandlerWrapper({
    requiredParams: ['logisticaDid'],
    optional: ['nombre', 'sync', 'codigo', 'codigoSync', 'direcciones', 'habilitado'],
    controller: ({ db, req }) => editLogistica({ db, req }),
  })
);

logisticas.get(
  '/',
  buildHandlerWrapper({
    controller: ({ db, req }) => getFilteredLogisticas({ db, req }),
  })
);

export default logisticas;
