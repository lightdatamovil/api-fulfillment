import express, { json, urlencoded } from 'express';
import cors from "cors";
import clientes from "./route/clientes.js";
import pedido from "./route/route-pedidos.js";
import insumos from "./route/insumos.js";
import producto from "./route/producto.js";
import publicacion from "./route/route-publicaciones.js";
import atributo from "./route/atributos.js";
import usuarios from "./route/usuarios.js";
import { logBlue, logRed, verifyToken } from "lightdata-tools";
import redisClient, { jwtSecret } from "./db.js";
import auth from "./route/auth.js";
import bootstrap from './route/bootstrap.js';

const app = express();

app.use(json({ limit: '50mb' }));
app.use(urlencoded({ limit: '50mb', extended: true }));
app.use(json());
app.use(cors());

const PORT = process.env.PORT;

app.use("/api/auth", auth);
app.use(verifyToken(jwtSecret));
app.use("/api/preload", bootstrap);
app.use("/api/atributos", atributo);
app.use("/api/clientes", clientes);
app.use("/api/insumos", insumos);
app.use("/api/pedidos", pedido);
app.use("/api/productos", producto);

app.use("/api/publicaciones", publicacion);
app.use("/api/usuarios", usuarios);

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
