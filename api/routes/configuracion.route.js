import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { toggleModoTrabajo } from "../controller/configuracion/modoTrabajo.js";
import { getModoTrabajo } from "../controller/configuracion/get_configuracion.js";

const configuracion = Router();

configuracion.put(
    "/toggle-modo-trabajo",
    buildHandlerWrapper({
        required: ["modo_trabajo"],
        controller: ({ db, req }) => toggleModoTrabajo({ db, req }),
    })
);

configuracion.get(
    "/",
    buildHandlerWrapper({
        controller: ({ db }) => getModoTrabajo({ db }),
    })
);

export default configuracion;
