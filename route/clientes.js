import { Router } from "express";
import { deleteCliente } from "../controller/cliente/delete_cliente.js";
import { getClienteById } from "../controller/cliente/get_cliente_by_id.js";
import { getFilteredClientes } from "../controller/cliente/get_filtered_clientes.js";
import { createCliente } from "../controller/cliente/create_cliente.js";
import { editCliente } from "../controller/cliente/edit_cliente.js";
import { buildHandler } from "./_handler.js";

const clientes = Router();

clientes.post(
  '/',
  buildHandler({
    required: ['nombre_fantasia', 'razon_social', 'codigo'],
    controller: async ({ db, req }) => {
      const result = await createCliente(db, req);
      return result;
    },
  })
);

clientes.put(
  '/:clienteId',
  buildHandler({
    requiredParams: ['clienteId'],
    required: ['nombre_fantasia', 'habilitado', 'observaciones', 'direccionesData', 'contactosData', 'cuentasData'],
    controller: async ({ db, req }) => {
      const result = await editCliente(db, req);
      return result;
    },
  })
);

clientes.get(
  '/:clienteId',
  buildHandler({
    requiredParams: ['clienteId'],
    controller: async ({ db, req }) => {
      const result = await getClienteById(db, req);
      return result;
    },
  })
);

clientes.get(
  '/',
  buildHandler({
    controller: async ({ db, req }) => {
      const result = await getFilteredClientes(db, req);
      return result;
    },
  })
);

clientes.delete(
  '/:clienteId',
  buildHandler({
    requiredParams: ['clienteId'],
    controller: async ({ db, req }) => {
      const result = await deleteCliente(db, req);
      return result;
    },
  })
);

export default clientes;
