import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

import { createOrdenTrabajo } from "../controller/orden-trabajo/create_orden_trabajo.js";
import { editOrdenTrabajo } from "../controller/orden-trabajo/edit_orden_trabajo.js";
import { deleteOrdenTrabajo } from "../controller/orden-trabajo/delete_orden_trabajo.js";
import { getOrdenTrabajoById } from "../controller/orden-trabajo/get_orden_trabajo_by_id.js";
import { getFilteredOrdenesTrabajo } from "../controller/orden-trabajo/get_filtered_ordenes_trabajo.js";

const ordenes = Router();

// POST /ordenes-trabajo
ordenes.post(
    "/",
    buildHandlerWrapper({
        optional: ["estado", "did_usuario", "did_pedidos"],
        controller: async ({ db, req }) => createOrdenTrabajo(db, req),
    })
);

// PUT /ordenes-trabajo/:did
ordenes.put(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        optional: ["estado", "asignada", "pedidos", "fecha_fin"],
        controller: async ({ db, req }) => {
            return editOrdenTrabajo(db, req);
        },
    })
);

// DELETE /ordenes-trabajo/:did
ordenes.delete(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: async ({ db, req }) => deleteOrdenTrabajo(db, req),
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
