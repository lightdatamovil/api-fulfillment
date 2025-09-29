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
        optional: ['email', 'habilitado', 'telefono', 'modulo_inicial', 'codigo_cliente', 'app_habilitada'],
        controller: async ({ db, req }) => {
            const result = await createUsuario(db, req);
            return result;
        },
    })
);

usuarios.get(
    '/',
    buildHandlerWrapper({
        controller: async ({ db, req }) => {
            const result = await getFilteredUsuarios(db, req);
            return result;
        },
    })
);

usuarios.get(
    '/:userId',
    buildHandlerWrapper({
        requiredParams: ['userId'],
        controller: async ({ db, req }) => {
            const result = await getUsuarioById(db, req);
            return result;
        },
    })
);

usuarios.put(
    '/:userId',
    buildHandlerWrapper({
        requiredParams: ['userId'],
        optional: ['nombre', 'apellido', 'usuario', 'password', 'perfil', 'email', 'habilitado', 'telefono', 'modulo_inicial', 'codigo_cliente', 'app_habilitada'],
        controller: async ({ db, req }) => {
            const result = await editUsuario(db, req);
            return result;
        },
    })
);

usuarios.delete(
    '/:userId',
    buildHandlerWrapper({
        requiredParams: ['userId'],
        controller: async ({ db, req }) => {
            const result = await deleteUsuario(db, req);
            return result;
        },
    })
);

export default usuarios;