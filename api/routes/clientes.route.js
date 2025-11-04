import { Router } from "express";
import { deleteCliente } from "../controller/cliente/delete_cliente.js";
import { getClienteById } from "../controller/cliente/get_cliente_by_id.js";
import { getFilteredClientes } from "../controller/cliente/get_filtered_clientes.js";
import { createCliente } from "../controller/cliente/create_cliente.js";
import { editCliente } from "../controller/cliente/edit_cliente.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const clientes = Router();

clientes.post(
  '/',
  buildHandlerWrapper({
    optional: ['nombre_fantasia', 'razon_social', 'codigo', 'habilitado', 'observaciones', 'direcciones', 'contactos', 'cuentas'],
    controller: ({ db, req }) => createCliente({ db, req }),
  })
);

clientes.put(
  '/:clienteId',
  buildHandlerWrapper({
    requiredParams: ['clienteId'],
    optional: ['nombre_fantasia', 'razon_social', 'codigo', 'habilitado', 'observaciones', 'direcciones', 'contactos', 'cuentas'],
    controller: ({ db, req }) => editCliente({ db, req }),
  })
);

clientes.get(
  '/:clienteId',
  buildHandlerWrapper({
    requiredParams: ['clienteId'],
    controller: ({ db, req }) => getClienteById({ db, req }),
  })
);

clientes.get(
  '/',
  buildHandlerWrapper({
    controller: ({ db, req }) => getFilteredClientes({ db, req }),
  })
);

clientes.delete(
  '/:clienteId',
  buildHandlerWrapper({
    requiredParams: ['clienteId'],
    optional: ["nombre_fantasia", "razon_social", "codigo", "habilitado", "observaciones", "direcciones", "contactos", "cuentas"],
    controller: ({ db, req }) => deleteCliente({ db, req }),
  })
);

export default clientes;
