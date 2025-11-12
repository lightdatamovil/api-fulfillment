import { Router } from "express";


import { createRemito } from "../controller/remito/create_remito.js";

import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const remitos = Router();

remitos.post(
    '/',
    buildHandlerWrapper({
        optional: ['did_cliente', 'observaciones', 'accion', 'remito_dids'],
        controller: ({ db, req }) => createRemito({ db, req }),
    })
);
/*
remitos.put(
  '/:clienteId',
  buildHandlerWrapper({
    requiredParams: ['clienteId'],
    optional: ['nombre_fantasia', 'razon_social', 'codigo', 'habilitado', 'observaciones', 'direcciones', 'contactos', 'cuentas'],
    controller: ({ db, req }) => editCliente({ db, req }),
  })
);

remitos.get(
  '/:clienteId',
  buildHandlerWrapper({
    requiredParams: ['clienteId'],
    controller: ({ db, req }) => getClienteById({ db, req }),
  })
);

remitos.get(
  '/',
  buildHandlerWrapper({
    controller: ({ db, req }) => getFilteredClientes({ db, req }),
  })
);

remitos.delete(
  '/:clienteId',
  buildHandlerWrapper({
    requiredParams: ['clienteId'],
    optional: ["nombre_fantasia", "razon_social", "codigo", "habilitado", "observaciones", "direcciones", "contactos", "cuentas"],
    controller: ({ db, req }) => deleteCliente({ db, req }),
  })
);
*/
export default remitos;
