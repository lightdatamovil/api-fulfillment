import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, logPurple, Status, verifyToken, verifyAll, verifyHeaders } from "lightdata-tools";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import { createUsuario } from "../controller/usuario/create_usuario.js";
import { deleteUsuario } from "../controller/usuario/delete_usuario.js";
import { getUsuarioById } from "../controller/usuario/get_usuario_by_id.js";
import { getUsuarios } from "../controller/usuario/get_filtered_usuarios.js";
import mysql2 from "mysql2";

const usuarios = Router();

usuarios.post("/", verifyToken(jwtSecret), async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, res);
        verifyAll(req, res, [], ['nombre', 'email', 'password']);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await createUsuario(dbConnection, req);

        res.status(Status.created).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

usuarios.delete("/:userId", verifyToken(jwtSecret), async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, ['X-Device-Id']);
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
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

usuarios.get("/", verifyToken(jwtSecret), async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, ['X-Device-Id']);
        verifyAll(req, [], []);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await getUsuarios(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

usuarios.get("/:userId", verifyToken(jwtSecret), async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, ['X-Device-Id']);
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
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

export default usuarios;