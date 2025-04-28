const amqp = require('amqplib');
const redis = require('redis');
const axios = require('axios'); 
const mysql = require('mysql'); // Para manejar solicitudes HTTP
const Ordenes = require('./controller/fulfillment/ordenes');
const Ordenes_items = require('./controller/fulfillment/ordenes_items');
const RABBITMQ_URL = 'amqp://lightdata:QQyfVBKRbw6fBb@158.69.131.226:5672';
let Aorders = [];

const redisClient = redis.createClient({
  socket: {
    host: '192.99.190.137',
    port: 50301,
  },
  password: 'sdJmdxXC8luknTrqmHceJS48NTyzExQg',
});

redisClient.on('error', (err) => {
  console.error('Error al conectar con Redis:', err);
});
async function getConnectionLocal(idempresa) {
  try {
      console.log("idempresa recibido:", idempresa);

      if (typeof idempresa !== 'string' && typeof idempresa !== 'number') {
          throw new Error(`idempresa debe ser un string o un número, pero es: ${typeof idempresa}`);
      }

      // Configuración de conexión al servidor MariaDB (sin base de datos)
      const config = {
          host: '149.56.182.49',
          port: 44347,
          user: `ue${idempresa}`,
          password: `78451296_${idempresa}`,
      };

      // Conexión sin base de datos para verificar existencia y crearla si es necesario
      const connection = await mysql.createConnection(config);
      const dbName = `empresa_${idempresa}`;

      // Crear la base de datos si no existe
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      console.log(`✅ Base de datos "${dbName}" verificada/creada.`);

      // Cerrar conexión temporal
      await connection.end();

      // 🔹 Esperar un breve momento para asegurarse de que la BD esté disponible
      await new Promise(resolve => setTimeout(resolve, 500));

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
    const token = await redisClient.hGet('token', seller_id);

    if (token) {
      return token;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error al obtener el token de Redis:', error);
    return null;
  }
}

async function getdataSeller(seller_id){

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
      console.error(`No se encontraron datos válidos para el envío ${resource}.`);
      return null;
    }
  } catch (error) {
    console.error(`Error al obtener datos del envío ${resource} desde Mercado Libre:`, error.message);
    return null;
  }
}
async function getdataSeller(seller_id) {
  try {
    // Asegurate de que Redis esté conectado
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    // Suponiendo que el seller_id es la key de un hash o el campo de un hash general
    const data = await redisClient.hGet('seller_ff_data', seller_id); // Cambiá 'sellers' si usás otra key

    if (data) {
      const parsedData = JSON.parse(data); // Si lo guardaste como JSON string
      console.log(parsedData.idempresa);
const      connection = await getConnectionLocal(parsedData.idempresa);




    } else {
      console.log(`No se encontró data para seller_id: ${seller_id}`);
    }
  } catch (err) {
    console.error('Error al obtener datos de Redis:', err);
  }
}
async function listenToChannel(channelName) {
  let connection;
  let channel;

  const connect = async () => {
      try {
          connection = await amqp.connect(RABBITMQ_URL);
          channel = await connection.createChannel();
          await channel.assertQueue(channelName, { durable: true });

          console.log(`Escuchando mensajes en el canal: ${channelName}`);
          channel.consume(channelName, async (msg) => {
              if (msg !== null) {
                  console.log(`Mensaje recibido en ${channelName}:`, msg.content.toString());
                  // {"resource":"/orders/2000011401704360","sellerid":"452306476","fecha":"2025-04-25 14:05:09"}

                  const datain = JSON.parse(msg.content.toString());

                  const seller_id = datain.sellerid;
                  const resource = datain.resource;

                  console.log(seller_id, resource);

                  const token = await getTokenForSeller(seller_id);
                  console.log(token);

                  // 🔵 Agrego correctamente la función getdataSeller adentro
                  async function getdataSeller(seller_id) {
                      try {
                          if (!redisClient.isOpen) {
                              await redisClient.connect();
                          }
                          const data = await redisClient.hGet('seller_ff_data', seller_id); // ahora uso la key correcta
                          if (data) {
                              const parsedData = JSON.parse(data);
                              console.log('Datos del Seller:', parsedData);
                              return parsedData; // 🔹 Devolver los datos parseados
                          } else {
                              console.log(`No se encontró data para seller_id: ${seller_id}`);
                              return null;
                          }
                      } catch (err) {
                          console.error('Error al obtener datos de Redis:', err);
                          return null;
                      }
                  }

                  // 🔵 Llamo correctamente la función y obtengo dataredis
                  const dataredis = await getdataSeller(seller_id);

                  console.log(dataredis,"datos de redis");

                  const connection= await getConnectionLocal(dataredis.idempresa);
                  

                  

                  if (token != null) {
                      const dataOrder = await obtenerDatosEnvioML(resource, token);
                      console.log(JSON.stringify(dataOrder, null, 2));
                      const keyorder = dataOrder.id + "-" + seller_id;

                      const ResultOrdenes = await InsertOrder(connection, dataOrder, dataredis);

                      if (!Aorders.includes(keyorder)) {
                          Aorders.push(keyorder);

                          // inserto

                          // actualizo estado
                      } else {
                          // actualizo estado
                      }
                  }

                  channel.ack(msg);  // Reconocer el mensaje manualmente
              }
          }, { noAck: false });

          connection.on('close', () => {
              console.log('La conexión con RabbitMQ se cerró. Reintentando...');
              setTimeout(connect, 1000);
          });

          channel.on('close', () => {
              console.log('El canal se cerró. Reintentando...');
              setTimeout(connect, 1000);
          });

      } catch (error) {
          console.error(`Error al escuchar el canal ${channelName}:`, error);
          setTimeout(connect, 1000);
      }
  };

  await connect();
}


async function InsertOrder(connection, data, dataredis) {


  const ordenData = {
      id: data.id,
      did: 0,
      didEnvio: data.shipping?.id ?? 0,
      didCliente: dataredis.idcliente ?? 0,
      didCuenta: dataredis.idcuenta ?? 0,
      status: data.status,
      flex: 1, // No hay info de flex
      number: String(data.id),
      fecha_venta: data.date_closed,
      observaciones: '',
      armado: 0,
      descargado: 0,
      fecha_armado: null, 
      quien_armado: 0,
      ml_shipment_id: data.shipping?.id ? String(data.shipping.id) : '',
      ml_id: String(data.id),
      ml_pack_id: data.pack_id ? String(data.pack_id) : '',
      buyer_id: data.buyer?.id ? String(data.buyer.id) : '',
      buyer_nickname: data.buyer?.nickname ?? '',
      buyer_name: data.buyer?.first_name ?? '',
      buyer_last_name: data.buyer?.last_name ?? '',
      total_amount: data.total_amount ?? 0
  };
console.log(ordenData, "esto es la fecha armado");

  const orden = new Ordenes(
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

    
      connection
  );

  const response = await orden.insert(ordenData);
  const variation_attribute = JSON.stringify(data.order_items[0].item.variation_attributes);

  const ordenes_items = new Ordenes_items(
    0,
    response.insertId,
    0,
    null, // Imagen por defecto si no existe
    data.order_items[0].item.title,  // Accede al primer item de 'order_items' y luego al 'title'
    data.order_items[0].item.id,  // ID del producto
    data.order_items[0].item.dimensions || "",  // Dimensiones del producto, por si no existe
    data.order_items[0].quantity,  // Cantidad
    variation_attribute, // Variación, si existe
    data.order_items[0].item.seller_sku,  // SKU del vendedor
    data.order_items[0].item.user_product_id,
    data.order_items[0].item.variation_id,  // ID del producto del usuario
    0,  // Descargado, valor por defecto
    0,  // Superado, valor por defecto
    0,  // Elim, valor por defecto
    connection
);

  const response2 = await ordenes_items.insert(); 
   


  console.log("Respuesta de insert orden:", response);
}



async function main() {
  try {
    await redisClient.connect();
    await listenToChannel('ordenesFF');
  // await getdataSeller('298477234');
  } catch (error) {
    await reiniciarScript();
    console.error('Error en la ejecución principal:', error);
  } finally {
    await redisClient.disconnect();
  }
}

main();
