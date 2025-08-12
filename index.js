import express, { json, urlencoded } from 'express';
import cors from "cors";
import orden from "./route/route-orden.js";
import cliente from "./route/route-cliente.js";
import empresa from "./route/route-empresa.js";
import pedido from "./route/route-pedidos.js";
import insumo from "./route/insumo.js";
import producto from "./route/route-producto.js";
import publicacion from "./route/route-publicaciones.js";
import atributo from "./route/route-atributo.js";
import stock from "./route/route-stock.js";
import usuario from "./route/usuario.js";
import seller from "./route/route-seller.js";
import { logBlue, logRed } from "lightdata-tools";
import redisClient from "./db.js";
import auth from "./route/auth.js";

const app = express();

app.use(json({ limit: '50mb' }));
app.use(urlencoded({ limit: '50mb', extended: true }));
app.use(json());
app.use(cors());

const PORT = process.env.PORT;

app.use("/api/auth", auth);
app.use("/api/atributo", atributo);
app.use("/api/cliente", cliente);
app.use("/api/empresa", empresa);
app.use("/api/insumo", insumo);
app.use("/api/orden", orden);
app.use("/api/pedido", pedido);
app.use("/api/producto", producto);
app.use("/api/publicaciones", publicacion);
app.use("/api/seller", seller);
app.use("/api/stock", stock);
app.use("/api/usuario", usuario);

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
