import { Router } from "express";
import { createlogistica } from "../controller/logistica/create_logistica.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";


const logisticas = Router();

logisticas.post(
  '/',
  buildHandlerWrapper({
    required: ['did', 'nombre', 'logisticaLD', 'codigo', 'codigoLD'],
    controller: async ({ db, req }) => {
      const result = await createlogistica(db, req);
      return result;
    },
  })
);
/**
logisticas.put(
 '/:logisticaId',
 buildHandlerWrapper({
   requiredParams: ['logisticaId'],
   required: ['nombre_fantasia', 'habilitado', 'observaciones', 'direccionesData', 'contactosData', 'cuentasData'],
   controller: async ({ db, req }) => {
     const result = await editlogistica(db, req);
     return result;
   },
 })
);

logisticas.get(
 '/:logisticaId',
 buildHandlerWrapper({
   requiredParams: ['logisticaId'],
   controller: async ({ db, req }) => {
     const result = await getlogisticaById(db, req);
     return result;
   },
 })
);

logisticas.get(
 '/',
 buildHandlerWrapper({
   controller: async ({ db, req }) => {
     const result = await getFilteredlogisticas(db, req);
     return result;
   },
 })
);

logisticas.delete(
 '/:logisticaId',
 buildHandlerWrapper({
   requiredParams: ['logisticaId'],
   controller: async ({ db, req }) => {
     const result = await deletelogistica(db, req);
     return result;
   },
 })
);
*/
export default logisticas;
