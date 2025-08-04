const amqp = require("amqplib");
const redis = require("redis");
const axios = require("axios");
const mysql = require("mysql"); // Para manejar solicitudes HTTP
const { executeQuery } = require("./dbconfig");
const Pedidos = require("./controller/pedido/pedidos");
const Pedidos_items = require("./controller/pedido/pedidos_items");
const pedidoHistorial = require("./controller/pedido/pedidos_historial");
const RABBITMQ_URL = "amqp://lightdata:QQyfVBKRbw6fBb@158.69.131.226:5672";
let Aorders = [];
let sellersStatus = [];

const redisClient = redis.createClient({
  socket: {
    host: "192.99.190.137",
    port: 50301,
  },
  password: "sdJmdxXC8luknTrqmHceJS48NTyzExQg",
});

redisClient.on("error", (err) => {
  console.error("Error al conectar con Redis:", err);
});
async function getConnectionLocal(idempresa) {
  try {
    ///  console.log("idempresa recibido:", idempresa);

    if (typeof idempresa !== "string" && typeof idempresa !== "number") {
      throw new Error(
        `idempresa debe ser un string o un número, pero es: ${typeof idempresa}`
      );
    }

    // Configuración de conexión al servidor MariaDB (sin base de datos)
    const config = {
      host: "149.56.182.49",
      port: 44347,
      user: `ue${idempresa}`,
      password: `78451296_${idempresa}`,
    };

    // Conexión sin base de datos para verificar existencia y crearla si es necesario
    const connection = await mysql.createConnection(config);
    const dbName = `empresa_${idempresa}`;

    // Crear la base de datos si no existe
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    //  console.log(`✅ Base de datos "${dbName}" verificada/creada.`);

    // Cerrar conexión temporal
    await connection.end();

    // 🔹 Esperar un breve momento para asegurarse de que la BD esté disponible
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Conectar a la base de datos específica
    const dbConfig = { ...config, database: dbName };
    const dbConnection = await mysql.createConnection(dbConfig);

    return dbConnection;
  } catch (error) {
    console.error(`❌ Error al obtener la conexión:`, error.message);
    throw {
      status: 500,
      response: {
        estado: false,
        error: -1,
        message: error.message,
      },
    };
  }
}

async function getTokenForSeller(seller_id) {
  try {
    if (!redisClient.isOpen) await redisClient.connect();
    const token = await redisClient.hGet("token", seller_id);

    if (token) {
      return token;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error al obtener el token de Redis:", error);
    return null;
  }
}

async function obtenerDatosEnvioML(resource, token) {
  try {
    const url = `https://api.mercadolibre.com${resource}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data && response.data.id) {
      return response.data;
    } else {
      console.error(
        `No se encontraron datos válidos para el envío ${resource}.`
      );
      return null;
    }
  } catch (error) {
    console.error(
      `Error al obtener datos del envío ${resource} desde Mercado Libre:`,
      error.message
    );
    return null;
  }
}

async function listenToChannel(channelName) {
  let connection = null;
  let channel = null;
  let isConnecting = false;

  const connect = async () => {
    if (isConnecting) return;
    isConnecting = true;

    // 🔁 Cerramos conexiones anteriores por las dudas
    if (channel) {
      try {
        await channel.close();
        console.log("Canal anterior cerrado correctamente.");
      } catch (e) {
        console.warn("No se pudo cerrar el canal anterior:", e.message);
      }
    }
    if (connection) {
      try {
        await connection.close();
        console.log("Conexión anterior cerrada correctamente.");
      } catch (e) {
        console.warn("No se pudo cerrar la conexión anterior:", e.message);
      }
    }

    try {
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertQueue(channelName, { durable: true });

      console.log(`✅ Escuchando mensajes en el canal: ${channelName}`);

      channel.consume(
        channelName,
        async (msg) => {
          if (msg !== null) {
            try {

              const datain = JSON.parse(msg.content.toString());
              const seller_id = datain.sellerid; // asegurarse que sea número
              const resource = datain.resource;

              // Lista de sellers permitidos
              const sellersPermitidos = ["298477234", "452306476", "23598767", "746339074"];
              console.log(`🔍 Verificando seller_id: ${seller_id}`);


              if (!sellersPermitidos.includes(seller_id)) {
                //  console.log(`⛔ Seller ${seller_id} no está permitido. Mensaje descartado.`);
                channel.ack(msg); // marcar como procesado para no reintentar
                return;
              }

              console.log(`📥 Mensaje recibido:`, datain);
              const token = await getTokenForSeller(seller_id);

              async function getdataSeller(seller_id) {
                try {
                  if (!redisClient.isOpen) await redisClient.connect();
                  const data = await redisClient.hGet("seller_ff_data", seller_id);
                  return data ? JSON.parse(data) : null;
                } catch (err) {
                  console.error("Error al obtener datos de Redis:", err);
                  return null;
                }
              }

              const dataredis = await getdataSeller(seller_id);
              console.log(`Datos del vendedor ${seller_id}:`, dataredis);

              const connLocal = await getConnectionLocal(dataredis.idempresa);

              if (token != null) {
                const dataOrder = await obtenerDatosEnvioML(resource, token);
                const keyorder = `${dataOrder.id}-${seller_id}`;

                await InsertOrder(connLocal, dataOrder, dataredis);

                if (!Aorders.includes(keyorder)) {
                  Aorders.push(keyorder);
                  // insertar y actualizar
                } else {
                  // solo actualizar
                }
              }

              channel.ack(msg);
            } catch (err) {
              console.error("Error procesando mensaje:", err);
              channel.nack(msg, false, false); // O descartá el mensaje
            }
          }
        },
        { noAck: false }
      );

      // 👇 Solo reconectamos desde acá
      connection.on("close", () => {
        console.warn("⚠️ Conexión cerrada. Reintentando en 1s...");
        isConnecting = false;
        setTimeout(connect, 1000);
      });

    } catch (error) {
      console.error(`❌ Error al conectar al canal ${channelName}:`, error);
      isConnecting = false;
      setTimeout(connect, 1000);
    }
  };

  await connect();
}

const ORDENES_INSERTADAS = {};
const ESTADOS_CACHE = {};

// Vaciar caché cada 2 semanas
setInterval(() => {
  console.log("Vaciando caché de estados...");
  Object.keys(ESTADOS_CACHE).forEach((key) => delete ESTADOS_CACHE[key]);
}, 1000 * 60 * 60 * 24 * 14);

// Función para obtener el estado anterior de una orden
async function getEstadoOrden(connection, did) {
  if (ESTADOS_CACHE[did]) {
    return ESTADOS_CACHE[did];
  }

  const query = "SELECT status FROM pedidos WHERE did = ?";
  const results = await executeQuery(connection, query, [did]);

  if (results.length > 0) {
    const estado = results[0].status;
    ESTADOS_CACHE[did] = estado;
    return estado;
  }

  return null;
}

async function InsertOrder(connection, data, dataredis) {
  const seller_id = String(data.seller.id);
  const number = String(data.id);
  const keyOrden = `${seller_id}_${number}`;

  let didParaUsar = 0;
  let nuevaOrden = false;
  let response = null;

  try {
    if (ORDENES_INSERTADAS[keyOrden]) {
      didParaUsar = ORDENES_INSERTADAS[keyOrden].did;
      console.log(`Orden encontrada en memoria, did: ${didParaUsar}`);
    } else {
      const query = "SELECT did FROM pedidos WHERE number = ?";
      const results = await executeQuery(connection, query, [number]);

      if (results.length > 0) {
        didParaUsar = results[0].did;
        ORDENES_INSERTADAS[keyOrden] = { did: didParaUsar };
        console.log(`Orden encontrada en BD, did: ${didParaUsar}`);
      } else {
        nuevaOrden = true;
      }
    }

    if (nuevaOrden) {
      const ordenData = {
        id: data.id,
        did: didParaUsar,
        didEnvio: 0,
        didCliente: dataredis.idcliente ?? 0,
        didCuenta: dataredis.idcuenta ?? 0,
        status: data.status,
        flex: 1,
        number: number,
        fecha_venta: data.date_closed,
        observaciones: "",
        armado: 0,
        descargado: 0,
        fecha_armado: null,
        quien_armado: 0,
        ml_shipment_id: data.shipping?.id ? String(data.shipping.id) : "",
        ml_id: String(data.id),
        ml_pack_id: data.pack_id ? String(data.pack_id) : "",
        buyer_id: data.buyer?.id ? String(data.buyer.id) : "",
        buyer_nickname: data.buyer?.nickname ?? "",
        buyer_name: data.buyer?.first_name ?? "",
        buyer_last_name: data.buyer?.last_name ?? "",
        total_amount: data.total_amount ?? 0,
        seller_sku: data.order_items[0].item.seller_sku ?? 0,
      };

      const pedido = new Pedidos(
        ordenData.did,
        ordenData.didEnvio,
        ordenData.didCliente,
        ordenData.didCuenta,
        ordenData.status,
        ordenData.flex,
        ordenData.number,
        ordenData.observaciones,
        ordenData.armado,
        ordenData.descargado,
        ordenData.fecha_armado,
        ordenData.fecha_venta,
        ordenData.quien_armado,
        ordenData.ml_shipment_id,
        ordenData.ml_id,
        ordenData.ml_pack_id,
        ordenData.buyer_id,
        ordenData.buyer_nickname,
        ordenData.buyer_name,
        ordenData.buyer_last_name,
        ordenData.total_amount,
        ordenData.seller_sku,
        connection
      );

      response = await pedido.insert(ordenData);
      console.log(response, "response de ordenes");

      if (response && response.insertId) {
        didParaUsar = response.insertId;
        ORDENES_INSERTADAS[keyOrden] = { did: didParaUsar };
        console.log(`Orden insertada nueva, did: ${didParaUsar}`);
      } else {
        console.log(`Error al insertar orden, no se obtuvo insertId`);
        return { insertId: 0 };
      }
    }

    // Verificar si hay cambio de estado (solo si no es nueva)
    let estadoCambiado = false;
    if (!nuevaOrden && didParaUsar !== 0) {
      const estadoAnterior = await getEstadoOrden(connection, didParaUsar);
      estadoCambiado = estadoAnterior !== data.status;
      if (estadoCambiado) {
        ESTADOS_CACHE[didParaUsar] = data.status; // actualizar en caché
      }
    }

    if (didParaUsar !== 0 && (nuevaOrden || estadoCambiado)) {
      const variation_attribute = JSON.stringify(
        data.order_items[0].item.variation_attributes
      );

      const pedidos_items = new Pedidos_items(
        0,
        didParaUsar,
        0,
        null,
        data.order_items[0].item.title,
        data.order_items[0].item.id,
        data.order_items[0].item.dimensions || "",
        data.order_items[0].quantity,
        variation_attribute,
        data.order_items[0].item.seller_sku ?? 0,
        data.order_items[0].item.user_product_id,
        data.order_items[0].item.variation_id,
        0,
        0,
        0,
        connection
      );

      await pedidos_items.insert();

      const pedidos_historial = new pedidoHistorial(
        didParaUsar,
        data.status,
        data.quien ?? 0,
        0,
        0,
        connection
      );

      await pedidos_historial.insert();
    } else {
      console.log(
        `Estado repetido para orden ${number}, no se inserta ítem ni historial`
      );
    }

    return { insertId: didParaUsar };
  } catch (error) {
    console.error("Error en InsertOrder:", error.message);
    return { insertId: 0 }; // Manejar el error y devolver un valor por defecto
  } finally {
    // Asegúrate de cerrar la conexión en el bloque finally
  }
}

async function main() {
  try {
    await redisClient.connect();
    await listenToChannel("ordenesFF");
    // await getdataSeller('298477234');
  } catch (error) {
    await reiniciarScript();
    console.error("Error en la ejecución principal:", error);
  } finally {
    await redisClient.disconnect();
  }
}

main();
