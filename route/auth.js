import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, logGreen, logPurple, Status, verifyAll, verifyHeaders } from "lightdata-tools";
import { companiesService, hostFulFillement, portFulFillement } from "../db.js";
import { loginApp } from "../controller/auth/login_app.js";
import { loginWeb } from "../controller/auth/login_web.js";
import { identification } from "../controller/auth/identification.js";
import mysql2 from "mysql2";

const auth = Router();

auth.get('/company-identification/:companyCode', async (req, res) => {
    const startTime = performance.now();

    try {
        verifyHeaders(req, ['X-Device-Id']);
        verifyAll(req, ['companyCode'], []);

        const { companyCode } = req.params;

        const company = await companiesService.getByCode(companyCode);

        const result = await identification(company);

        logGreen(`Empresa identificada correctamente`);
        res.status(Status.ok).json({ body: result, message: "Empresa identificada correctamente" });
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
    }
});

auth.post("/login-app", async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, ['X-Device-Id']);
        verifyAll(req, [], ['username', 'password', 'companyId']);

        const { companyId } = req.body;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await loginApp(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

auth.post("/login-web", async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, ['X-Device-Id']);
        verifyAll(req, [], ['username', 'password', 'companyId']);

        const { companyId } = req.body;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await loginWeb(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

export default auth;
