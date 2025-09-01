import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, Status, verifyAll, verifyHeaders } from "lightdata-tools";
import { companiesService, hostFulFillement, portFulFillement } from "../db.js";
import { loginApp } from "../controller/auth/login_app.js";
import { loginWeb } from "../controller/auth/login_web.js";
import { identification } from "../controller/auth/identification.js";
import mysql2 from "mysql2";

const auth = Router();

auth.get('/company-identification/:companyCode', async (req, res) => {
    try {
        verifyHeaders(req, []);
        verifyAll(req, ['companyCode'], {});

        const { companyCode } = req.params;

        const company = await companiesService.getByCode(companyCode);

        const result = await identification(company);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    }
});

auth.post("/login-app", async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, [], {
            required: ['username', 'password', 'companyId'],
            optional: []
        });

        const { companyId } = req.body;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await loginApp(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

auth.post("/login-web", async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, [], {
            required: ['username', 'password', 'companyId'],
            optional: []
        });

        const { companyId } = req.body;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await loginWeb(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

export default auth;
