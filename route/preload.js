import { Router } from "express";
import { preloader } from "../controller/bootstrap/bootstrap.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const preload = Router();

preload.get(
    '/',
    buildHandlerWrapper({
        controller: async ({ db, req }) => {
            const result = await preloader(db, req);
            return result;
        },
    })
);

export default preload;
