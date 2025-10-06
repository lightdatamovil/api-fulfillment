import { Router } from "express";
import { createlogistica } from "../controller/logistica/create_logistica.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { getlogisticaById } from "../controller/logistica/get_logsitica_by_id.js";
import { deleteLogistica } from "../controller/logistica/delete_logistica.js";
import { editLogistica } from "../controller/logistica/edit_logistica.js";


const logisticas = Router();

logisticas.post(
  '/',
  buildHandlerWrapper({
    required: ['nombre', 'esLightdata', 'codigo', 'codigoLD', 'direcciones'],
    controller: async ({ db, req }) => {
      const result = await createlogistica(db, req);
      return result;
    },
  })
);

logisticas.get(
  '/:logisticaDid',
  buildHandlerWrapper({
    requiredParams: ['logisticaDid'],
    controller: async ({ db, req }) => {
      const result = await getlogisticaById(db, req);
      return result;
    },
  })
);

logisticas.delete(
  '/:logisticaDid',
  buildHandlerWrapper({
    requiredParams: ['logisticaDid'],
    controller: async ({ db, req }) => {
      const result = await deleteLogistica(db, req);
      return result;
    },
  })
);

logisticas.put(
  '/:logisticaDid',
  buildHandlerWrapper({
    requiredParams: ['logisticaDid'],
    optional: ['nombre', 'esLightdata', 'codigo', 'codigoLD', 'direcciones'],
    controller: async ({ db, req }) => {
      const result = await editLogistica(db, req);
      return result;
    },
  })
);

/** 





logisticas.get(
  '/',
  buildHandlerWrapper({
    controller: async ({ db, req }) => {
      const result = await getFilteredlogisticas(db, req);
      return result;
    },
  })
);

*/
export default logisticas;
