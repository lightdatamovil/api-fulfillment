import { Router } from "express";
import { getFilteredAtributos } from "../controller/atributo/get_filtered_atributos.js";
import { getAtributoById } from "../controller/atributo/get_atributo_by_id.js";
import { deleteAtributo } from "../controller/atributo/delete_atributo.js";
import { createAtributo } from "../controller/atributo/create_atributo.js";
import { buildHandler } from "./_handler.js";

const atributos = Router();

atributos.post(
  '/',
  buildHandler({
    required: ['codigo', 'nombre', 'descripcion', 'habilitado', 'orden', 'atributoValores'],
    controller: async ({ db, req }) => {
      const result = await createAtributo(db, req);
      return result;
    },
  })
);

atributos.delete(
  '/',
  buildHandler({
    requiredParams: ['userId'],
    controller: async ({ db, req }) => {
      const result = await deleteAtributo(db, req);
      return result;
    },
  })
);

atributos.get(
  '/:atributoId',
  buildHandler({
    requiredParams: ['userId'],
    controller: async ({ db, req }) => {
      const result = await getAtributoById(db, req);
      return result;
    },
  })
);

atributos.get(
  '/',
  buildHandler({
    controller: async ({ db, req }) => {
      const result = await getFilteredAtributos(db, req);
      return result;
    },
  })
);

atributos.put(
  '/:atributoId',
  buildHandler({
    required: ['codigo', 'nombre', 'descripcion', 'habilitado', 'orden', 'atributoValores'],
    controller: async ({ db, req }) => {
      const result = await getFilteredAtributos(db, req);
      return result;
    },
  })
);

export default atributos;