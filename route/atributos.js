import { Router } from "express";
import { getFilteredAtributos } from "../controller/atributo/get_filtered_atributos.js";
import { getAtributoById } from "../controller/atributo/get_atributo_by_id.js";
import { deleteAtributo } from "../controller/atributo/delete_atributo.js";
import { createAtributo } from "../controller/atributo/create_atributo.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const atributos = Router();

atributos.post(
  '/',
  buildHandlerWrapper({
    required: ['codigo', 'nombre', 'descripcion', 'habilitado', 'orden', 'atributoValores'],
    controller: async ({ db, req }) => {
      const result = await createAtributo(db, req);
      return result;
    },
  })
);

atributos.delete(
  '/',
  buildHandlerWrapper({
    requiredParams: ['userId'],
    controller: async ({ db, req }) => {
      const result = await deleteAtributo(db, req);
      return result;
    },
  })
);

atributos.get(
  '/:atributoId',
  buildHandlerWrapper({
    requiredParams: ['atributoId'],
    controller: async ({ db, req }) => {
      const result = await getAtributoById(db, req);
      return result;
    },
  })
);

atributos.get(
  '/',
  buildHandlerWrapper({
    controller: async ({ db, req }) => {
      const result = await getFilteredAtributos(db, req);
      return result;
    },
  })
);

atributos.put(
  '/:atributoId',
  buildHandlerWrapper({
    required: ['codigo', 'nombre', 'descripcion', 'habilitado', 'orden', 'atributoValores'],
    controller: async ({ db, req }) => {
      const result = await getFilteredAtributos(db, req);
      return result;
    },
  })
);

export default atributos;