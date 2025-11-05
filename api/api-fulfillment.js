import express, { json, urlencoded } from 'express';
import cors from "cors";
import clientes from "./routes/clientes.route.js";
import pedido from "./routes/pedidos.route.js";
import insumos from "./routes/insumos.route.js";
import producto from "./routes/producto.route.js";
import publicacion from "./routes/route-publicaciones.route.js";
import variantes from "./routes/variantes.route.js";
import usuarios from "./routes/usuarios.route.js";
import curvas from './routes/curva.route.js';
import ordenesTrabajo from './routes/ordenes_trabajo.route.js';
import { logBlue, logRed, verifyToken } from "lightdata-tools";
import redisClient, { jwtIssuer, jwtAudience } from "./db.js";
import auth from "./routes/auth.route.js";
import preload from './routes/preload.route.js';
import logisticas from './routes/logisticas.route.js';
import { jwtSecret } from './db.js';
import configuracion from './routes/configuracion.route.js';
import depositos from './routes/depositos.route.js';
import stock from './routes/stock.route.js';

const app = express();

app.use(json({ limit: '50mb' }));
app.use(urlencoded({ limit: '50mb', extended: true }));
app.use(json());
app.use(cors());

const PORT = process.env.PORT;

app.use("/api/auth", auth);
app.use(verifyToken({ jwtSecret, jwtIssuer, jwtAudience }));
app.use("/api/preload", preload);
app.use("/api/variantes", variantes);
app.use("/api/logisticas", logisticas);
app.use("/api/clientes", clientes);
app.use("/api/insumos", insumos);
app.use("/api/pedidos", pedido);
app.use("/api/productos", producto);
app.use("/api/publicaciones", publicacion);
app.use("/api/usuarios", usuarios);
app.use("/api/curvas", curvas);
app.use("/api/ordenes-trabajo", ordenesTrabajo);
app.use("/api/configuracion", configuracion);
app.use("/api/stock", stock);
app.use("/api/depositos", depositos);


(async () => {
  try {
    app.listen(PORT, () => {
      logBlue(`Servidor corriendo en el puerto ${PORT}`);
    });

    await redisClient.connect();

    process.on("SIGINT", async () => {
      process.exit();
    });
  } catch (err) {
    logRed(err);
  }
})();
