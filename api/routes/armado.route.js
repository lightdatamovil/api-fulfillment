import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { armar } from "../controller/orden-trabajo/armar.js";

const armadoOt = Router();

armadoOt.post(
    "/",
    buildHandlerWrapper({
        requiredParams: ["did"],
        optional: ["productos", "did_ot"],
        controller: ({ db, req }) => armar({ db, req }),
    })
);

export default armadoOt;
