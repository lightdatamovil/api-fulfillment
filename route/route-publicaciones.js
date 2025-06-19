const express = require("express");
const publicaciones = express.Router();

const {
    redisClient,
    getConnection,
    getCompanyById,
    getConnectionLocal,
} = require("../dbconfig");

const { logRed } = require("../fuctions/logsCustom");

const Atributo = require("../controller/atributo/atributos");
const Atributo_valor = require("../controller/atributo/atributo_valor");
const { log } = require("node:console");
const verificarToken = require("../middleware/token");
const { getPublicacionesML, getPublicacionesTN, getPublicacionesUnificadas, obtenerDatosUnificados, getPublicacionesMLSimplificado, getPublicacionesTNSimplificado, unificarPublicaciones, construirAtributosConDids } = require("../controller/publicacionesMLTN/publicaciones");

publicaciones.post("/publicacionesML", async (req, res) => {
    try {
        // const data = req.body;
        //   const connection = await getConnectionLocal(data.idEmpresa);
        //console.log("data", data);


        const publicaciones = await getPublicacionesMLSimplificado();
        res.status(200).json({
            estado: true,
            response: publicaciones,
        });

    } catch (error) {
        console.error("Error en publicacionesML:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message,
        });
    }
});
publicaciones.post("/publicacionesTN", async (req, res) => {
    try {
        // const data = req.body;
        //   const connection = await getConnectionLocal(data.idEmpresa);
        //console.log("data", data);


        const publicaciones = await getPublicacionesTNSimplificado();
        res.status(200).json({
            estado: true,
            response: publicaciones,
        });

    } catch (error) {
        console.error("Error en publicacionesML:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message,
        });
    }
});
publicaciones.post("/juntar", async (req, res) => {

    try {
        // const data = req.body;
        //   const connection = await getConnectionLocal(data.idEmpresa);
        //console.log("data", data);


        const publicaciones = await getPublicacionesUnificadas();
        res.status(200).json({
            estado: true,
            response: publicaciones,
        });

    } catch (error) {
        console.error("Error en publicacionesML:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message,
        });
    }


})

publicaciones.post("/uni", async (req, res) => {

    try {
        // const data = req.body;
        //   const connection = await getConnectionLocal(data.idEmpresa);
        //console.log("data", data);


        const publicaciones = await unificarPublicaciones();
        res.status(200).json({
            estado: true,
            response: publicaciones,
        });

    } catch (error) {
        console.error("Error en publicacionesML:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message,
        });
    }


})

publicaciones.post("/variante", async (req, res) => {

    try {
        const data = req.body;
        const connection = await getConnectionLocal(data.idEmpresa);
        console.log("data", data);


        const publicaciones = await construirAtributosConDids(connection);
        res.status(200).json({
            estado: true,
            response: publicaciones,
        });

    } catch (error) {
        console.error("Error en publicacionesML:", error);
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message,
        });
    }


})


module.exports = publicaciones;
