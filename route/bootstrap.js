import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools";
import mysql2 from "mysql2";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import { bootstrap } from "../controller/bootstrap/bootstrap.js";

const init = Router();

init.get('/', verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;
    try {
        verifyHeaders(req, []);
        verifyAll(req, [], {});

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await bootstrap(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

export default init;
