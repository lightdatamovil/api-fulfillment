import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

import { createOrdenTrabajo } from "../controller/orden-trabajo/create_orden_trabajo.js";
import { updateOrdenTrabajo } from "../controller/orden-trabajo/update_orden_trabajo.js";
import { deleteOrdenTrabajo } from "../controller/orden-trabajo/delete_orden_trabajo.js";
import { getOrdenTrabajoById } from "../controller/orden-trabajo/get_orden_trabajo_by_id.js";
import { getFilteredOrdenesTrabajo } from "../controller/orden-trabajo/get_filtered_ordenes_trabajo.js";

const ordenes = Router();

// POST /ordenes-trabajo
ordenes.post(
    "/",
    buildHandlerWrapper({
        required: ["estado", "asignada", "fecha_inicio", "pedidos", "pedidosEstados"],
        // No hay required obligatorios; crea la OT y luego se puede asignar pedidos/estados opcionalmente
        controller: async ({ db, req }) => createOrdenTrabajo(db, req),
    })
);

// PUT /ordenes-trabajo/:did
ordenes.put(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        required: ["estado", "asignada", "pedidos", "pedidosEstados"],
        controller: async ({ db, req }) => {
            req.body.did = Number(req.params.did);
            return updateOrdenTrabajo(db, req);
        },
    })
);

// DELETE /ordenes-trabajo/:did
ordenes.delete(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: async ({ db, req }) => {
            req.body.did = Number(req.params.did);
            return deleteOrdenTrabajo(db, req);
        },
    })
);

// GET /ordenes-trabajo/:did
ordenes.get(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: async ({ db, req }) => getOrdenTrabajoById(db, req),
    })
);

// GET /ordenes-trabajo
ordenes.get(
    "/",
    buildHandlerWrapper({
        controller: async ({ db, req }) => getFilteredOrdenesTrabajo(db, req),
    })
);

export default ordenes;
