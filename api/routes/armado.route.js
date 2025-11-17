import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { armado } from "../controller/armado/armado.js";



const armadoOt = Router();






armadoOt.post(
    "/",
    buildHandlerWrapper({
        requiredParams: ["did"],
        optional: ["productos", "did_ot"],
        controller: ({ db, req }) => armado({ db, req }),
    })
);





export default armadoOt;
