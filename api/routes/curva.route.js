// rutas/curvas.routes.js
import { Router } from "express";
import { createCurva } from "../controller/curva/create_curva.js";
import { editCurva } from "../controller/curva/edit_curva.js";
import { deleteCurva } from "../controller/curva/delete_curva.js";
import { getCurvaById } from "../controller/curva/get_curva_by_id.js";
import { getFilteredCurvas } from "../controller/curva/get_filtered_curvas.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const curvas = Router();

curvas.post(
    "/",
    buildHandlerWrapper({
        requiredParams: ["userId"],
        optional: ["categorias", "nombre", "codigo", "habilitado"],
        controller: ({ db, req }) => createCurva({ db, req }),
    })
);

curvas.put(
    "/:curvaDid",
    buildHandlerWrapper({
        requiredParams: ["userId", "curvaDid"],
        optional: ["nombre", "categorias", "codigo", "habilitado"],
        controller: ({ db, req }) => editCurva({ db, req }),
    })
);

curvas.delete(
    "/:curvaDid",
    buildHandlerWrapper({
        requiredParams: ["userId", "curvaDid"],
        controller: ({ db, req }) => deleteCurva({ db, req }),
    })
);

curvas.get(
    "/:curvaDid",
    buildHandlerWrapper({
        requiredParams: ["curvaDid"],
        controller: ({ db, req }) => getCurvaById({ db, req }),
    })
);

curvas.get(
    "/",
    buildHandlerWrapper({
        controller: ({ db, req }) => getFilteredCurvas({ db, req }),
    })
);

export default curvas;
