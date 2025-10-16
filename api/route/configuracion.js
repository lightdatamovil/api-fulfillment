// rutas/curvas.routes.js
import { Router } from "express";


import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { toggleModoTrabajo } from "../controller/configuracion/modoTrabajo.js";

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



export default configuracion;
