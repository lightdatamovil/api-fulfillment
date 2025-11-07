import { Router } from "express";

import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";
import { identificadores_especiales } from "../controller/campos-adicionales/create_identificadores_especiales.js";
import { deleteIdentificadoresEspeciales } from "../controller/campos-adicionales/delete_identificadores_especiales.js";
import { editIdentificadoresEspeciales } from "../controller/campos-adicionales/edit_identificadores_especiales.js";
import { getFilteredCamposEspeciales } from "../controller/campos-adicionales/get_filtered_campos_especiales.js";
import { getIdentificadoresEspecialesById } from "../controller/campos-adicionales/get_identificadores_especiales_by_id.js";



const identificadoresEspeciales = Router();


identificadoresEspeciales.post(
    '/',
    buildHandlerWrapper({
        optional: ['nombre', "tipo"],
        controller: ({ db, req }) => identificadores_especiales({ db, req }),
    })
);
identificadoresEspeciales.put(
    '/:identificador_especial_did',
    buildHandlerWrapper({
        optional: ['nombre', "tipo"],
        controller: ({ db, req }) => editIdentificadoresEspeciales({ db, req }),
    })
);
identificadoresEspeciales.get(
    '/',
    buildHandlerWrapper({
        controller: ({ db, req }) => getFilteredCamposEspeciales({ db, req }),
    })
);



identificadoresEspeciales.get(
    '/:identificador_especial_did',
    buildHandlerWrapper({
        requiredParams: ['identificador_especial_did'],
        controller: ({ db, req }) => getIdentificadoresEspecialesById({ db, req }),
    })
);

identificadoresEspeciales.delete(
    '/:identificador_especial_did',
    buildHandlerWrapper({
        requiredParams: ['identificador_especial_did'],
        controller: ({ db, req }) => deleteIdentificadoresEspeciales({ db, req }),
    })
);

export default identificadoresEspeciales;
