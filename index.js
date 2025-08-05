const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { cargarEmpresasMap } = require("./fuctions/empresaMap");

// Inicializar variable global
global.empresasCodigos = {};
cargarEmpresasMap();

// Variable local para empresas de Redis
let empresasDB = null;


const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


// Rutas
app.use("/producto", require("./route/route-producto"));
app.use("/cliente", require("./route/route-cliente"));
app.use("/empresa", require("./route/route-empresa"));
app.use("/serviceSellerToken", require("./route/route-seller"));
app.use("/usuario", require("./route/route-usuario"));
app.use("/atributo", require("./route/route-atributo"));
app.use("/stock", require("./route/route-stock"));
app.use("/pedido", require("./route/route-pedidos"));
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
      console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });

    process.on("SIGINT", async () => {
      console.log("Cerrando servidor...");

      process.exit();
    });
  } catch (err) {
    console.error("Error al iniciar el servidor:", err);
  }
})();
