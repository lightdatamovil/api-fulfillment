import { Router } from "express";
import { getPublicacionesUnificadas, getPublicacionesMLSimplificado, getPublicacionesTNSimplificado, unificarPublicaciones, construirAtributosDesdePublicaciones } from "../controller/publicacionesMLTN/publicaciones.js";
import { getFFProductionDbConfig } from "lightdata-tools";

const publicacion = Router();

publicacion.post("/publicacionesML", async (req, res) => {
    try {

        const publicaciones = await getPublicacionesMLSimplificado();
        res.status(200).json({
            estado: true,
            response: publicaciones,
        });

    } catch (error) {
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message,
        });
    }
});
publicacion.post("/publicacionesTN", async (req, res) => {
    try {
        const publicaciones = await getPublicacionesTNSimplificado();
        res.status(200).json({
            estado: true,
            response: publicaciones,
        });

    } catch (error) {
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message,
        });
    }
});
publicacion.post("/juntar", async (req, res) => {
    try {
        const publicaciones = await getPublicacionesUnificadas();
        res.status(200).json({
            estado: true,
            response: publicaciones,
        });
    } catch (error) {
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message,
        });
    }
})

publicacion.post("/uni", async (req, res) => {
    try {
        const { tn = true, ml = true, pagina = 1, cantidad = 20 } = req.body;

        const publicaciones = await unificarPublicaciones(pagina, cantidad, tn, ml);

        res.status(200).json({
            estado: true,
            response: publicaciones,
        });

    } catch (error) {
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener las publicaciones.",
            error: error.message,
        });
    }
});

publicacion.post("/getProductosImportados", async (req, res) => {
    try {
        const data = req.body;
        const connection = getFFProductionDbConfig(data.idEmpresa);

        const publicaciones = await construirAtributosDesdePublicaciones(connection);
        res.status(200).json({
            estado: true,
            data: publicaciones,
        });

    } catch (error) {
        return res.status(500).json({
            estado: false,
            mensaje: "Error al obtener los atributos del producto.",
            error: error.message,
        });
    }
})

export default publicacion;
