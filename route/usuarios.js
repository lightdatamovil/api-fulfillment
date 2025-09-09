import { Router } from "express";
import { createUsuario } from "../controller/usuario/create_usuario.js";
import { deleteUsuario } from "../controller/usuario/delete_usuario.js";
import { getUsuarioById } from "../controller/usuario/get_usuario_by_id.js";
import { getFilteredUsuarios } from "../controller/usuario/get_filtered_usuarios.js";
import { editUsuario } from "../controller/usuario/edit_usuario.js";
import { buildHandler } from "./_handler.js";

const usuarios = Router();

usuarios.post(
    '/',
    buildHandler({
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
    buildHandler({
        controller: async ({ db, req }) => {
            const result = await getFilteredUsuarios(db, req);
            return result;
        },
    })
);

usuarios.get(
    '/:userId',
    buildHandler({
        requiredParams: ['userId'],
        controller: async ({ db, req }) => {
            const result = await getUsuarioById(db, req);
            return result;
        },
    })
);

usuarios.put(
    '/:userId',
    buildHandler({
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
    buildHandler({
        requiredParams: ['userId'],
        controller: async ({ db, req }) => {
            const result = await deleteUsuario(db, req);
            return result;
        },
    })
);

export default usuarios;