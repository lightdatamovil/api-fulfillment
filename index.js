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

const app = express();

app.use(json({ limit: '50mb' }));
app.use(urlencoded({ limit: '50mb', extended: true }));
app.use(json());
app.use(cors());

const PORT = process.env.PORT;

app.use("/atributo", atributo);
app.use("/cliente", cliente);
app.use("/empresa", empresa);
app.use("/insumo", insumo);
app.use("/orden", orden);
app.use("/pedido", pedido);
app.use("/producto", producto);
app.use("/publicaciones", publicacion);
app.use("/seller", seller);
app.use("/stock", stock);
app.use("/usuario", usuario);

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
