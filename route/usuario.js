import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, logPurple, Status, verifyToken, verifyAll, verifyHeaders } from "lightdata-tools";
import { hostFulFillement, portFulFillement } from "../db";
import { createUsuario } from "../controller/usuario/create_usuario";
import { deleteUsuario } from "../controller/usuario/delete_usuario";
import { getUsuarioById } from "../controller/usuario/get_usuario_by_id";
import { getUsuarios } from "../controller/usuario/get_usuarios";

const usuario = Router();

usuario.post("/", verifyToken, async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, res);
        verifyAll(req, res, [], ['nombre', 'email', 'password']);
        dbConnection = getFFProductionDbConfig(req.body.idEmpresa, hostFulFillement, portFulFillement);

        const result = await createUsuario(dbConnection, req);

        res.status(Status.created).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

usuario.delete("/", verifyToken, async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, res);
        verifyAll(req, res, [], ['id']);
        dbConnection = getFFProductionDbConfig(req.body.idEmpresa, hostFulFillement, portFulFillement);

        const result = await deleteUsuario(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

usuario.get("/:userId", verifyToken, async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, res);
        verifyAll(req, res, [], ['id']);
        dbConnection = getFFProductionDbConfig(req.body.idEmpresa, hostFulFillement, portFulFillement);

        const res = await getUsuarioById(dbConnection, req);

        return res.status(Status.ok).json(res);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

usuario.get("/", verifyToken, async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, res);
        verifyAll(req, res, [], ['id']);
        dbConnection = getFFProductionDbConfig(req.body.idEmpresa, hostFulFillement, portFulFillement);

        const response = await getUsuarios(dbConnection, req);

        return res.status(Status.ok).json({
            success: true,
            totalRegistros: response["totalRegistros"],
            totalPaginas: response["totalPaginas"],
            pagina: response["pagina"],
            cantidad: response["cantidad"],
            data: response["usuarios"],
        });
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

export default usuario;
