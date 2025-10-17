// rutas/curvas.routes.js
import { Router } from "express";
import { createCurva } from "../controller/curva/create_curva.js";
import { editCurva } from "../controller/curva/edit_curva.js";
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
        optional: ["categorias", "nombre", "codigo", "habilitado"],
        controller: async ({ db, req }) => {
            const result = await createCurva(db, req);
            return result;
        },
    })
);

// PUT /curvas/:curvaDid  (editar)
curvas.put(
    "/:curvaDid",
    buildHandlerWrapper({
        requiredParams: ["userId", "curvaDid"],
        required: ["nombre", "variantes"],
        controller: async ({ db, req }) => {
            const result = await editCurva(db, req);
            return result;
        },
    })
);

// DELETE /curvas/:curvaDid  (eliminar - soft delete)
curvas.delete(
    "/:curvaDid",
    buildHandlerWrapper({
        requiredParams: ["userId", "curvaDid"],
        controller: async ({ db, req }) => {
            const result = await deleteCurva(db, req);
            return result;
        },
    })
);

// GET /curvas/:curvaDid  (by id)
curvas.get(
    "/:curvaDid",
    buildHandlerWrapper({
        requiredParams: ["curvaDid"],
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
