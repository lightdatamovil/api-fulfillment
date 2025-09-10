import { Router } from "express";
import { bootstrap } from "../controller/bootstrap/bootstrap.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const init = Router();

init.get(
    '/',
    buildHandlerWrapper({
        controller: async ({ db, req }) => {
            const result = await bootstrap(db, req);
            return result;
        },
    })
);

export default init;
