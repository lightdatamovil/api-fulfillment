import { Router } from "express";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { createDeposito } from "../controller/depositos/create_deposito.js";
import { editDeposito } from "../controller/depositos/edit_deposito.js";
import { deleteDeposito } from "../controller/depositos/delete_deposito.js";
import { getDepositoById } from "../controller/depositos/get_deposito_by_id.js";
import { getFilteredDepositos } from "../controller/depositos/get_filtered_depositos.js";

const depositos = Router();

depositos.post(
    "/",
    buildHandlerWrapper({
        requiredParams: ["userId"],
        optional: ["direccion", "descripcion", "codigo", "email", "telefono"],
        controller: ({ db, req }) => createDeposito({ db, req }),
    })
);

depositos.put(
    "/:depositoDid",
    buildHandlerWrapper({
        requiredParams: ["userId", "depositoDid"],
        optional: ["direccion", "descripcion", "codigo", "email", "telefono"],
        controller: ({ db, req }) => editDeposito({ db, req }),
    })
);

depositos.delete(
    "/:depositoDid",
    buildHandlerWrapper({
        requiredParams: ["userId", "depositoDid"],
        controller: ({ db, req }) => deleteDeposito({ db, req }),
    })
);

depositos.get(
    "/:depositoDid",
    buildHandlerWrapper({
        requiredParams: ["depositoDid"],
        controller: ({ db, req }) => getDepositoById({ db, req }),
    })
);

depositos.get(
    "/",
    buildHandlerWrapper({
        controller: ({ db, req }) => getFilteredDepositos({ db, req }),
    })
);

export default depositos;
