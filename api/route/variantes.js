import { Router } from "express";
import { getFilteredVariantes } from "../controller/variantes/get_filtered_variantes.js";
import { getVarianteById } from "../controller/variantes/get_variante_by_id.js";
import { deleteVarianteCategoria } from "../controller/variantes/delete_variante.js";
import { createVariante } from "../controller/variantes/create_variante.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { editVariante } from "../controller/variantes/edit_variante.js";

const variantes = Router();

variantes.post(
  '/',
  buildHandlerWrapper({
    optional: ['codigo', 'nombre', 'descripcion', 'habilitado', 'orden', "categorias"],
    controller: async ({ db, req }) => {
      const result = await createVariante(db, req);
      return result;
    },
  })
);


// variantes.routes.js

variantes.delete(
  '/:did',
  buildHandlerWrapper({
    requiredParams: ['userId'],   // lo saca de req.user
    required: ['did'],            // lo mandás en el body: { "did": 123 }
    controller: async ({ db, req }) => {
      const result = await deleteVarianteCategoria(db, req);
      return result;
    },
  })
);


variantes.get(
  '/:varianteId',
  buildHandlerWrapper({
    requiredParams: ['varianteId'],
    controller: async ({ db, req }) => {
      const result = await getVarianteById(db, req);
      return result;
    },
  })
);

variantes.get(
  '/',
  buildHandlerWrapper({
    controller: async ({ db, req }) => {
      const result = await getFilteredVariantes(db, req);
      return result;
    },
  })
);
variantes.put(
  '/:varianteId',
  buildHandlerWrapper({
    optional: ['codigo', 'nombre', 'descripcion', 'habilitado', 'orden', 'categorias'],
    controller: async ({ db, req }) => {
      const result = await editVariante(db, req);
      return result;
    },
  })
);

export default variantes;