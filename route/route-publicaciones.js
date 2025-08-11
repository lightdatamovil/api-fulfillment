import { Router } from "express";
import { getPublicacionesUnificadas, getPublicacionesMLSimplificado, getPublicacionesTNSimplificado, unificarPublicaciones, construirAtributosDesdePublicaciones } from "../controller/publicacionesMLTN/publicaciones";

const publicaciones = Router();

publicaciones.post("/publicacionesML", async (req, res) => {
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
publicaciones.post("/publicacionesTN", async (req, res) => {
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
publicaciones.post("/juntar", async (req, res) => {

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

publicaciones.post("/uni", async (req, res) => {
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

publicaciones.post("/getProductosImportados", async (req, res) => {
    try {
        const data = req.body;
        const connection = await getConnectionLocal(data.idEmpresa);

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

export default publicaciones;
