import { Router } from "express";
import { preloader } from "../controller/preload/preloader.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const preload = Router();

preload.get(
    '/',
    buildHandlerWrapper({
        controller: async ({ db }) => {
            const result = await preloader(db);
            return result;
        },
    })
);

export default preload;
