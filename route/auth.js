import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, logGreen, logPurple, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools";
import { companiesService, hostFulFillement, portFulFillement } from "../db.js";
import { login } from "../controller/auth/login";
import { identification } from "../controller/auth/identification";

const auth = Router();

auth.post('/company-identification', async (req, res) => {
    const startTime = performance.now();
    try {
        verifyHeaders(req, res);
        verifyAll(req, res, [], ['companyCode']);

        const { companyCode } = req.body;

        const company = await companiesService.getByCode(companyCode);

        const result = await identification(company);

        logGreen(`Empresa identificada correctamente`);
        res.status(Status.ok).json({ body: result, message: "Empresa identificada correctamente" });
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        const endTime = performance.now();
        logPurple(`Tiempo de ejecución: ${endTime - startTime} ms`);
    }
});

auth.post("/login", verifyToken, async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, res);
        verifyAll(req, res, [], ['usuario', 'password']);
        dbConnection = getFFProductionDbConfig(req.body.idEmpresa, hostFulFillement, portFulFillement);

        const result = await login(dbConnection, req);

        res.status(Status.created).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

export default auth;
