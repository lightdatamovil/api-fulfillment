import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { sincronizacionEnvio } from "../controller/sincronizacion-envio/sincronizacion_envio.js";



const sincronizacion = Router();

sincronizacion.post(
    '/',
    buildHandlerWrapper({
        optional: ["did_pedido", "didEmpresa"],
        controller: ({ db, req }) => sincronizacionEnvio({ db, req }),
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
export default sincronizacion;
