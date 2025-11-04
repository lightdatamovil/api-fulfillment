import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { createOrdenTrabajo } from "../controller/orden-trabajo/create_orden_trabajo.js";
import { editOrdenTrabajo } from "../controller/orden-trabajo/edit_orden_trabajo.js";
import { deleteOrdenTrabajo } from "../controller/orden-trabajo/delete_orden_trabajo.js";
import { getOrdenTrabajoById } from "../controller/orden-trabajo/get_orden_trabajo_by_id.js";
import { getFilteredOrdenesTrabajo } from "../controller/orden-trabajo/get_filtered_ordenes_trabajo.js";

const ordenes = Router();

ordenes.post(
    "/",
    buildHandlerWrapper({
        required: ["estado", "asignada", "fecha_inicio", "pedidos", "pedidosEstados"],
        controller: ({ db, req }) => createOrdenTrabajo({ db, req }),
    })
);

ordenes.put(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        optional: ["estado", "asignada", "pedidos", "fecha_fin"],
        controller: ({ db, req }) => editOrdenTrabajo({ db, req }),
    })
);

ordenes.delete(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => deleteOrdenTrabajo({ db, req }),
    })
);

ordenes.get(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => getOrdenTrabajoById({ db, req }),
    })
);

ordenes.get(
    "/",
    buildHandlerWrapper({
        controller: ({ db, req }) => getFilteredOrdenesTrabajo({ db, req }),
    })
);

export default ordenes;
