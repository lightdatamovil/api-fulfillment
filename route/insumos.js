import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import { createInsumo } from "../controller/insumo/create_insumo.js";
import { getInsumosById } from "../controller/insumo/get_insumo_by_id.js";
import { deleteInsumo } from "../controller/insumo/delete_insumo.js";
import { getFilteredInsumos } from "../controller/insumo/get_filtered_insumos.js";
import mysql2 from "mysql2";
import { editInsumo } from "../controller/insumo/edit_insumo.js";

const insumos = Router();

insumos.post("/", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, [], ['codigo', 'habilitado', 'clientes', 'nombre', 'unidad']);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await createInsumo(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

insumos.put("/:insumoId", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, ['insumoId'], ['codigo', 'habilitado', 'clientes', 'nombre', 'unidad']);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await editInsumo(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

insumos.get("/", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, [], []);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await getFilteredInsumos(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end()
    }
});

insumos.get("/:insumoId", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, ['insumoId'], []);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await getInsumosById(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

insumos.delete("/:insumoId", verifyToken(jwtSecret), async (req, res) => {
    let dbConnection;

    try {
        verifyHeaders(req, []);
        verifyAll(req, ['insumoId'], []);

        const { companyId } = req.user;

        const dbConfig = getFFProductionDbConfig(companyId, hostFulFillement, portFulFillement);
        dbConnection = mysql2.createConnection(dbConfig);
        dbConnection.connect();

        const result = await deleteInsumo(dbConnection, req);

        res.status(Status.ok).json(result);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        if (dbConnection) dbConnection.end();
    }
});

export default insumos;
