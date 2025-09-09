import { Router } from "express";
import { bootstrap } from "../controller/bootstrap/bootstrap.js";
import { buildHandler } from "./_handler.js";

const init = Router();

init.get(
    '/',
    buildHandler({
        controller: async ({ db, req }) => {
            const result = await bootstrap(db, req);
            return result;
        },
    })
);

export default init;
