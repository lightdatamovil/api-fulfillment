import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, logPurple, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools";
import mysql2 from "mysql2";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import { getInitInfo } from "../controller/init/get_init_info.js";

const init = Router();

init.get('/', verifyToken(jwtSecret), async (req, res) => {
    const startTime = performance.now();

    let dbConnection;
    try {
        verifyHeaders(req, ['X-Device-Id']);
        verifyAll(req, [], []);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await getInitInfo(dbConnection, req);

        res.status(Status.ok).json({ body: result, message: "Datos iniciales obtenidos correctamente" });
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();

    }
});

export default init;
