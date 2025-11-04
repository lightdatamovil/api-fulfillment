import { Router } from "express";
import { createInsumo } from "../controller/insumo/create_insumo.js";
import { getInsumosById } from "../controller/insumo/get_insumo_by_id.js";
import { deleteInsumo } from "../controller/insumo/delete_insumo.js";
import { getFilteredInsumos } from "../controller/insumo/get_filtered_insumos.js";
import { editInsumo } from "../controller/insumo/edit_insumo.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const insumos = Router();

insumos.post(
    '/',
    buildHandlerWrapper({
        required: ['codigo', 'habilitado', 'clientes_dids', 'nombre', 'unidad'],
        controller: async ({ db, req }) => {
            const result = await createInsumo(db, req);
            return result;
        },
    })
);

insumos.put(
    '/:insumoId',
    buildHandlerWrapper({
        optional: ['codigo', 'habilitado', 'clientes_dids', 'nombre', 'unidad'],
        controller: async ({ db, req }) => {
            const result = await editInsumo(db, req);
            return result;
        },
    })
);

insumos.get(
    '/',
    buildHandlerWrapper({
        controller: async ({ db, req }) => {
            const result = await getFilteredInsumos(db, req);
            return result;
        },
    })
);

insumos.get(
    '/:insumoId',
    buildHandlerWrapper({
        requiredParams: ['insumoId'],
        controller: async ({ db, req }) => {
            const result = await getInsumosById(db, req);
            return result;
        },
    })
);

insumos.delete(
    '/:insumoId',
    buildHandlerWrapper({
        requiredParams: ['insumoId'],
        controller: async ({ db, req }) => {
            const result = await deleteInsumo(db, req);
            return result;
        },
    })
);

export default insumos;
