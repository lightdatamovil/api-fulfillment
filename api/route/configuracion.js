// rutas/curvas.routes.js
import { Router } from "express";


import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { toggleModoTrabajo } from "../controller/configuracion/modoTrabajo.js";
import { getModoTrabajo } from "../controller/configuracion/get_configuracion.js";

const configuracion = Router();

configuracion.put(
    "/toggle-modo-trabajo",
    buildHandlerWrapper({
        required: ["modoTrabajo"],
        controller: async ({ db, req }) => {
            const result = await toggleModoTrabajo(db, req);
            return result;
        },
    })
);

configuracion.get(
    "/",
    buildHandlerWrapper({
        controller: async ({ db }) => {
            const result = await getModoTrabajo(db);
            return result;
        },
    })
);



export default configuracion;
