import { Router } from "express";
import { errorHandler, getFFProductionDbConfig, logPurple, Status, verifyAll, verifyHeaders, verifyToken } from "lightdata-tools";
import { hostFulFillement, jwtSecret, portFulFillement } from "../db.js";
import { createInsumo } from "../controller/insumo/create_insumo.js";
import { getInsumosById } from "../controller/insumo/get_insumo_by_id.js";
import { deleteInsumo } from "../controller/insumo/delete_insumo.js";
import { getFilteredInsumos } from "../controller/insumo/get_filtered_insumos.js";
import mysql2 from "mysql2";

const insumo = Router();

insumo.post("/", verifyToken(jwtSecret), async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, res);
        verifyAll(req, res, [], ['nombre', 'codigo', 'idCliente']);


        const res = await createInsumo(dbConnection, req);

        res.status(Status.ok).json(res);
    } catch (error) {
        errorHandler(req, res, error);
    } finally {
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

insumo.get("/", verifyToken(jwtSecret), async (req, res) => {
    const data = req.body;
    const { pagina, cantidad, nombre, habilitado, codigo, did, didCliente } = data;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);
    try {
        const response = await getFilteredInsumos(connection, {
            pagina: pagina || 1,
            cantidad: cantidad || 10,
            nombre: nombre || "",
            habilitado: habilitado || "",
            codigo: codigo || "",
            did: did || "",
            didCliente: didCliente || "",
        });
        if (response.estado === false) {
            return res.status(400).json({
                estado: false,
                message: response.message || response,
            });
        }

        return res.status(200).json({
            estado: true,
            totalRegistros: response["totalRegistros"],
            totalPaginas: response["totalPaginas"],
            pagina: response["pagina"],
            cantidad: response["cantidad"],
            data: response["data"],
        });
    } catch (error) {
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});

insumo.get("/:insumoId", verifyToken(jwtSecret), async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, ['X-Device-Id']);
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
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

insumo.delete("/:insumoId", verifyToken(jwtSecret), async (req, res) => {
    const startTime = performance.now();

    let dbConnection;

    try {
        verifyHeaders(req, ['X-Device-Id']);
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
        logPurple(`Tiempo de ejecución: ${performance.now() - startTime} ms`);
        if (dbConnection) dbConnection.end();
    }
});

export default insumo;
