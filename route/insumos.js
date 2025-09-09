import { Router } from "express";
import { createInsumo } from "../controller/insumo/create_insumo.js";
import { getInsumosById } from "../controller/insumo/get_insumo_by_id.js";
import { deleteInsumo } from "../controller/insumo/delete_insumo.js";
import { getFilteredInsumos } from "../controller/insumo/get_filtered_insumos.js";
import { editInsumo } from "../controller/insumo/edit_insumo.js";
import { buildHandler } from "./_handler.js";

const insumos = Router();

insumos.post(
    '/',
    buildHandler({
        required: ['codigo', 'habilitado', 'clientes', 'nombre', 'unidad'],
        controller: async ({ db, req }) => {
            const result = await createInsumo(db, req);
            return result;
        },
    })
);

insumos.put(
    '/:insumoId',
    buildHandler({
        optional: ['codigo', 'habilitado', 'clientes', 'nombre', 'unidad'],
        controller: async ({ db, req }) => {
            const result = await editInsumo(db, req);
            return result;
        },
    })
);

insumos.get(
    '/',
    buildHandler({
        controller: async ({ db, req }) => {
            const result = await getFilteredInsumos(db, req);
            return result;
        },
    })
);

insumos.get(
    '/:insumoId',
    buildHandler({
        requiredParams: ['insumoId'],
        controller: async ({ db, req }) => {
            const result = await getInsumosById(db, req);
            return result;
        },
    })
);

insumos.delete(
    '/:insumoId',
    buildHandler({
        requiredParams: ['insumoId'],
        controller: async ({ db, req }) => {
            const result = await deleteInsumo(db, req);
            return result;
        },
    })
);

export default insumos;
