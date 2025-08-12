import express from "express";
import { json, urlencoded } from "body-parser";
import cors from "cors";
import orden from "./route/route-orden";
import cliente from "./route/route-cliente";
import empresa from "./route/route-empresa";
import pedido from "./route/route-pedidos";
import insumo from "./route/route-insumo";
import producto from "./route/route-producto";
import publicacion from "./route/route-publicaciones";
import atributo from "./route/route-atributo";
import stock from "./route/route-stock";
import usuario from "./route/route-usuario";
import seller from "./route/route-seller";
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
