import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { createPedido } from "../controller/pedido/create_pedido.js";
import { editPedido } from "../controller/pedido/edir_pedido.js";
import { deletePedido } from "../controller/pedido/delete_pedido.js";
import { getPedidoById } from "../controller/pedido/get_pedido_by_id.js";
import { getFilteredPedidos } from "../controller/pedido/get_filtered_pedidos.js";

const pedidos = Router();

pedidos.post(
    "/",

    buildHandlerWrapper({
        optional: ["did_cliente", "did_cuenta", "estado", "observacion", "total", "productos", "direccion", "id_venta", "comprador", "deadline", "fecha_venta", "insumos"],
        controller: ({ db, req }) => createPedido({ db, req }),
    })
);

pedidos.put(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        optional: ["did_pedido", "did_cliente", "did_cuenta", "estado", "observacion", "total", "productos", "direccion", "id_venta", "comprador"],
        controller: ({ db, req }) => editPedido({ db, req }),
    })
);

pedidos.delete(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => deletePedido({ db, req }),
    })
);

pedidos.get(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: async ({ db, req }) => getPedidoById({ db, req }),
    })
);

pedidos.get(
    "/",
    buildHandlerWrapper({
        controller: async ({ db, req }) => getFilteredPedidos({ db, req }),
    })
);

export default pedidos;
