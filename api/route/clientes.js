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
    controller: async ({ db, req }) => {
      const result = await createCliente(db, req);
      return result;
    },
  })
);

clientes.put(
  '/:clienteId',
  buildHandlerWrapper({
    requiredParams: ['clienteId'],
    optional: ['nombre_fantasia', 'razon_social', 'codigo', 'habilitado', 'observaciones', 'direcciones', 'contactos', 'cuentas'],
    controller: async ({ db, req }) => {
      const result = await editCliente(db, req);
      return result;
    },
  })
);

clientes.get(
  '/:clienteId',
  buildHandlerWrapper({
    requiredParams: ['clienteId'],
    controller: async ({ db, req }) => {
      const result = await getClienteById(db, req);
      return result;
    },
  })
);

clientes.get(
  '/',
  buildHandlerWrapper({
    controller: async ({ db, req }) => {
      const result = await getFilteredClientes(db, req);
      return result;
    },
  })
);

clientes.put(
  '/delete/:clienteId',
  buildHandlerWrapper({
    requiredParams: ['clienteId'],
    optional: ["nombre_fantasia", "razon_social", "codigo", "habilitado", "observaciones", "direcciones", "contactos", "cuentas"],
    controller: async ({ db, req }) => {
      const result = await deleteCliente(db, req);
      return result;
    },
  })
);

export default clientes;
