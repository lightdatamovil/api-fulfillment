import { Router } from "express";
import { getFilteredVariantes } from "../controller/variantes/get_filtered_variantes.js";
import { getVarianteById } from "../controller/variantes/get_variante_by_id.js";
import { deleteVariante } from "../controller/variantes/delete_variante.js";
import { createVariante } from "../controller/variantes/create_variante.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { editVariante } from "../controller/variantes/edit_variante.js";

const variantes = Router();

variantes.post(
  '/',
  buildHandlerWrapper({
    optional: ['codigo', 'nombre', 'descripcion', 'habilitado', 'orden', "categorias"],
    controller: ({ db, req }) => createVariante({ db, req }),
  })
);

variantes.delete(
  '/:did',
  buildHandlerWrapper({
    requiredParams: ['userId'],
    required: ['did'],
    controller: ({ db, req }) => deleteVariante({ db, req }),
  })
);

variantes.get(
  '/:varianteId',
  buildHandlerWrapper({
    requiredParams: ['varianteId'],
    controller: ({ db, req }) => getVarianteById({ db, req }),
  })
);

variantes.get(
  '/',
  buildHandlerWrapper({
    controller: async ({ db, req }) => getFilteredVariantes({ db, req }),
  })
);

variantes.put(
  '/:varianteId',
  buildHandlerWrapper({
    optional: ['codigo', 'nombre', 'descripcion', 'habilitado', 'orden', 'categorias'],
    controller: async ({ db, req }) => editVariante({ db, req }),
  })
);

export default variantes;