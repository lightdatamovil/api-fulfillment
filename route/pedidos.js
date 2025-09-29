// rutas/pedidos.routes.js
import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

import { createPedido } from "../controller/pedido/create_pedido.js";
import { updatePedido } from "../controller/pedido/update_pedido.js";
import { deletePedido } from "../controller/pedido/delete_pedido.js";
import { getPedidoById } from "../controller/pedido/get_pedido_by_id.js";
import { getFilteredPedidos } from "../controller/pedido/get_filtered_pedidos.js";

const pedidos = Router();

// POST /pedidos  (crear)
pedidos.post(
    "/",
    buildHandlerWrapper({
        // body obligatorio
        required: ["did_cuenta", "items"],
        optional: ["status", "number", "fecha_venta", "buyer_nickname", "ml_shipment_id", "ml_pack_id", "ml_id", "total_amount"],
        controller: async ({ db, req }) => {
            return createPedido(db, req);
        },
    })
);

// PUT /pedidos/:did  (actualizar snapshot + opcional resync de items)
pedidos.put(
    "/:did",
    buildHandlerWrapper({
        // param obligatorio
        requiredParams: ["did"],
        controller: async ({ db, req }) => {
            // Pasamos el param → body para el controlador (si tu controller lo espera en body)
            req.body.did = Number(req.params.did);
            return updatePedido(db, req);
        },
    })
);

// DELETE /pedidos/:did  (soft delete)
pedidos.delete(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: async ({ db, req }) => {
            req.body.did = Number(req.params.did);
            return deletePedido(db, req);
        },
    })
);

// GET /pedidos/:did  (detalle)
pedidos.get(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: async ({ db, req }) => {
            return getPedidoById(db, req);
        },
    })
);

// GET /pedidos  (listado filtrado/paginado)
pedidos.get(
    "/",
    buildHandlerWrapper({
        controller: async ({ db, req }) => {
            return getFilteredPedidos(db, req);
        },
    })
);

export default pedidos;
