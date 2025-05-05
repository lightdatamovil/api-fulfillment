const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { redisClient, getFromRedis } = require("./dbconfig");
const { cargarEmpresasMap } = require("./fuctions/empresaMap");

// Inicializar variable global
global.empresasCodigos = {};
cargarEmpresasMap();

// Variable local para empresas de Redis
let empresasDB = null;

async function actualizarEmpresas() {
  try {
    const empresasDataJson = await getFromRedis("empresasData");
    empresasDB = empresasDataJson || [];
  } catch (error) {
    console.error("Error al actualizar empresas desde Redis:", error);
  }
}

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// Middleware para actualizar empresas desde Redis si no están
app.use(async (req, res, next) => {
  if (!empresasDB) {
    await actualizarEmpresas();
  }
  next();
});

// Rutas
app.use("/fulfillment", require("./route/route-fulfillment"));
app.use("/producto", require("./route/route-producto"));
app.use("/cliente", require("./route/route-cliente"));
app.use("/fmas", require("./route/route-fmas"));
app.use("/empresa", require("./route/route-empresa"));
app.use("/serviceSellerToken", require("./route/route-seller"));
app.use("/usuario", require("./route/route-usuario"));
app.use("/clienteCuenta", require("./route/route-clienteCuenta"));
app.use("/atributo", require("./route/route-atributo"));
app.use("/stock", require("./route/route-stock"));
app.use("/ordenes", require("./route/route-ordenes"));

app.get("/", (req, res) => {
  res.status(200).json({
    estado: true,
    mesanje: "Hola chris",
  });
});

const PORT = 13000;

(async () => {
  try {
    await actualizarEmpresas();

    app.listen(PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });

    process.on("SIGINT", async () => {
      console.log("Cerrando servidor...");
      await redisClient.disconnect();
      process.exit();
    });
  } catch (err) {
    console.error("Error al iniciar el servidor:", err);
  }
})();
