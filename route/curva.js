// rutas/curvas.routes.js
import { Router } from "express";
import { createCurva } from "../controller/curva/create_curva.js";
import { updateCurva } from "../controller/curva/update_curva.js";
import { deleteCurva } from "../controller/curva/delete_curva.js";
import { getCurvaById } from "../controller/curva/get_curva_by_id.js";
import { getFilteredCurvas } from "../controller/curva/get_filtered_curvas.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const curvas = Router();

// POST /curvas  (crear)
curvas.post(
    "/",
    buildHandlerWrapper({
        requiredParams: ["userId"],
        required: ["categorias", "nombre"], // categorias (number[]) es opcional
        controller: async ({ db, req }) => {
            const result = await createCurva(db, req);
            return result;
        },
    })
);

// PUT /curvas/:did  (editar)
curvas.put(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["userId", "did"],
        required: ["nombre", "categorias"], // categorias (number[]) es opcional
        controller: async ({ db, req }) => {
            // pasamos el did de params → body para el controlador
            req.body.did = Number(req.params.did);
            const result = await updateCurva(db, req);
            return result;
        },
    })
);

// DELETE /curvas/:did  (eliminar - soft delete)
curvas.delete(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["userId", "did"],
        controller: async ({ db, req }) => {
            // pasamos el did de params → body para el controlador
            req.body.did = Number(req.params.did);
            const result = await deleteCurva(db, req);
            return result;
        },
    })
);

// GET /curvas/:did  (by id)
curvas.get(
    "/:did",
    buildHandlerWrapper({
        requiredParams: ["did"],
        controller: async ({ db, req }) => {
            const result = await getCurvaById(db, req);
            return result;
        },
    })
);

// GET /curvas  (listado filtrado/paginado)
curvas.get(
    "/",
    buildHandlerWrapper({
        controller: async ({ db, req }) => {
            const result = await getFilteredCurvas(db, req);
            return result;
        },
    })
);

export default curvas;
