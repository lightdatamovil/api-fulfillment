import express from "express";
import { json, urlencoded } from "body-parser";
import cors from "cors";
import { cargarEmpresasMap } from "./fuctions/empresaMap";

global.empresasCodigos = {};
cargarEmpresasMap();

const app = express();
app.use(json({ limit: "50mb" }));
app.use(urlencoded({ limit: "50mb", extended: true }));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/producto", require("./route/route-producto").default);
app.use("/cliente", require("./route/route-cliente"));
app.use("/empresa", require("./route/route-empresa"));
app.use("/serviceSellerToken", require("./route/route-seller"));
app.use("/usuario", require("./route/route-usuario"));
app.use("/atributo", require("./route/route-atributo"));
app.use("/stock", require("./route/route-stock"));
app.use("/pedido", require("./route/route-pedidos"));
app.use("/orden", require("./route/route-orden"));
app.use("/insumo", require("./route/route-insumo"));
app.use("/publicaciones", require("./route/route-publicaciones"));
app.get("/", (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

const PORT = 13000;

(async () => {
  try {


    app.listen(PORT, () => {
    });

    process.on("SIGINT", async () => {

      process.exit();
    });
  } catch (err) {
  }
})();
