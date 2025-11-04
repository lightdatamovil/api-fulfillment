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
        controller: ({ db, req }) => createInsumo({ db, req }),
    })
);

insumos.put(
    '/:insumoId',
    buildHandlerWrapper({
        optional: ['codigo', 'habilitado', 'clientes_dids', 'nombre', 'unidad'],
        controller: ({ db, req }) => editInsumo({ db, req }),
    })
);

insumos.get(
    '/',
    buildHandlerWrapper({
        controller: ({ db, req }) => getFilteredInsumos({ db, req }),
    })
);

insumos.get(
    '/:insumoId',
    buildHandlerWrapper({
        requiredParams: ['insumoId'],
        controller: ({ db, req }) => getInsumosById({ db, req }),
    })
);

insumos.delete(
    '/:insumoId',
    buildHandlerWrapper({
        requiredParams: ['insumoId'],
        controller: ({ db, req }) => deleteInsumo({ db, req }),
    })
);

export default insumos;
