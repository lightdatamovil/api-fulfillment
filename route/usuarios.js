import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, Status, verifyToken, verifyAll, verifyHeaders } from "lightdata-tools";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import { createUsuario } from "../controller/usuario/create_usuario.js";
import { deleteUsuario } from "../controller/usuario/delete_usuario.js";
import { getUsuarioById } from "../controller/usuario/get_usuario_by_id.js";
import { getFilteredUsuarios } from "../controller/usuario/get_filtered_usuarios.js";
import mysql2 from "mysql2";
import { editUsuario } from "../controller/usuario/edit_usuario.js";

const usuarios = Router();

usuarios.post("/", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, [], ['nombre', 'apellido', 'email', 'email', 'usuario', 'password', 'perfil', 'habilitado', 'app_habilitada', 'modulo_inicial', 'telefono', 'codigo_cliente']);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await createUsuario(dbConnection, req);

        res.status(Status.created).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

usuarios.get("/", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, [], []);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await getFilteredUsuarios(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

usuarios.get("/:userId", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, ['userId'], []);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await getUsuarioById(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

usuarios.put("/:userId", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, ['userId'], ['nombre', 'apellido', 'email', 'email', 'usuario', 'password', 'perfil', 'habilitado', 'app_habilitada', 'modulo_inicial', 'telefono', 'codigo_cliente']);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await editUsuario(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

usuarios.delete("/:userId", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, ['userId'], []);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await deleteUsuario(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

export default usuarios;