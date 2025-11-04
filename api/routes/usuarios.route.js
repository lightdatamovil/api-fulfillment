import { Router } from "express";
import { createUsuario } from "../controller/usuarios/create_usuario.js";
import { deleteUsuario } from "../controller/usuarios/delete_usuario.js";
import { getUsuarioById } from "../controller/usuarios/get_usuario_by_id.js";
import { getFilteredUsuarios } from "../controller/usuarios/get_filtered_usuarios.js";
import { editUsuario } from "../controller/usuarios/edit_usuario.js";
import { buildHandlerWrapper } from "../src/functions/build_handler_wrapper.js";

const usuarios = Router();

usuarios.post(
    '/',
    buildHandlerWrapper({
        required: ['nombre', 'apellido', 'usuario', 'password', 'perfil'],
        optional: ['email', 'habilitado', 'telefono', 'modulo_inicial', 'codigo_cliente', 'app_habilitada', "imagen"],
        controller: ({ db, req }) => createUsuario({ db, req }),
    })
);

usuarios.get(
    '/',
    buildHandlerWrapper({
        controller: ({ db, req }) => getFilteredUsuarios({ db, req }),
    })
);

usuarios.get(
    '/:userId',
    buildHandlerWrapper({
        requiredParams: ['userId'],
        controller: ({ db, req }) => getUsuarioById({ db, req }),
    })
);

usuarios.put(
    '/:userId',
    buildHandlerWrapper({
        requiredParams: ['userId'],
        optional: ["nombre", "apellido", "email", "usuario", "pass", "imagen", "habilitado", "perfil", "accesos", "tipo", "modulo_inicial", "app_habilitada", "telefono", "codigo_cliente"],
        controller: ({ db, req }) => editUsuario({ db, req }),
    })
);

usuarios.delete(
    '/:userDid',
    buildHandlerWrapper({
        requiredParams: ['userDid'],
        controller: ({ db, req }) => deleteUsuario({ db, req }),
    })
);

export default usuarios;