import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { createOrdenTrabajo } from "../controller/orden-trabajo/create_orden_trabajo.js";
import { editOrdenTrabajo } from "../controller/orden-trabajo/edit_orden_trabajo.js";
import { deleteOrdenTrabajo } from "../controller/orden-trabajo/delete_orden_trabajo.js";
import { changeEstadoAOrdenDeTrabajo } from "../controller/orden-trabajo/change_estado_a_orden_de_trabajo.js";
import { getFilteredOrdenesTrabajoByClienteFiltered } from "../controller/orden-trabajo/get_ordenes_trabajo_by_cliente_filtered.js";
import { getFilteredOrdenesTrabajoByDid } from "../controller/orden-trabajo/get_orden_trabajo_by_id.js";
import { desasignarOrdenTrabajo } from "../controller/orden-trabajo/desasignar.js";
import { informeArmado } from "../controller/orden-trabajo/informe_armado.js";

const ordenes = Router();

ordenes.post(
    "/",
    buildHandlerWrapper({
        optional: ["estado", "did_usuario", "did_pedidos"],
        controller: async ({ db, req }) => createOrdenTrabajo({ db, req }),
    })
);

ordenes.put(
    "/cambiar-estado",
    buildHandlerWrapper({
        required: ["estado", "dids_ots"],
        controller: ({ db, req }) => changeEstadoAOrdenDeTrabajo({ db, req }),
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

// GET /ordenes-trabajo/:did // LOCAMBIO A ORDEN DE TRABAJO BY CIENTE
// ordenes.get(
//     "/:did_cliente",
//     buildHandlerWrapper({
//         requiredParams: ["did"],
//         controller: async ({ db, req }) => getFilteredOrdenesTrabajoByCliente({ db, req }),
//     })
// );

ordenes.get(
    "/",
    buildHandlerWrapper({
        controller: async ({ db, req }) => getFilteredOrdenesTrabajoByClienteFiltered({ db, req }),
    })
);


ordenes.get(
    "/informe-armado",
    buildHandlerWrapper({
        requiredParams: ['fecha_from', 'fecha_to'],
        controller: function ({ db, req }) {
            console.log("Generando informe de armado desde");
            return informeArmado({ db, req });
        },
    })
);
ordenes.get(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => getFilteredOrdenesTrabajoByDid({ db, req }),
    })
);

ordenes.put(
    "/:did/desasignar",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: ({ db, req }) => desasignarOrdenTrabajo({ db, req }),
    })
);

export default ordenes;
