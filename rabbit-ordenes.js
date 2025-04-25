const amqp = require('amqplib');
const redis = require('redis');
const axios = require('axios'); 
const mysql = require('mysql'); // Para manejar solicitudes HTTP
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
              //{"resource":"/orders/2000011401704360","sellerid":"452306476","fecha":"2025-04-25 14:05:09"}
              
              const datain = JSON.parse(msg.content.toString());
              
              const seller_id = datain.sellerid;
              const resource = datain.resource;
              
              console.log(seller_id, resource);
              
              const  token = await getTokenForSeller(seller_id);

              console.log(token);

              //const dataSeller =  await getdataSeller(seller_id);
              //busco en la base de datos sql


              async function getdataSeller(seller_id) {
                try {
                  // Asegurate de que Redis esté conectado
                  if (!redisClient.isOpen) {
                    await redisClient.connect();
                  }
              
                  // Suponiendo que el seller_id es la key de un hash o el campo de un hash general
                  const data = await redisClient.hGet('sellers', seller_id); // Cambiá 'sellers' si usás otra key
              
                  if (data) {
                    const parsedData = JSON.parse(data); // Si lo guardaste como JSON string
                    console.log(parsedData);
                  } else {
                    console.log(`No se encontró data para seller_id: ${seller_id}`);
                  }
                } catch (err) {
                  console.error('Error al obtener datos de Redis:', err);
                }
              }
              
              
              if(token != null){
                  const dataOrder = await obtenerDatosEnvioML(resource, token);
                  const keyorder = dataOrder.id+"-"+seller_id;
                  
                  console.log(JSON.stringify(dataOrder, null, 2));

                  
                  if (!Aorders.includes(keyorder)) {					 
                    Aorders.push(keyorder); 
                    
                    
                      //inserto 
                  
                      //actualizo estado
                  }else{

                    //actualizo estado
                  
                  }
                    
					      }
                  
					
                    channel.ack(msg);  // Reconocer el mensaje manualmente
                }
            }, { noAck: false });

            // Manejo de la desconexión de RabbitMQ
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

async function main() {
  try {
    await redisClient.connect();
    await listenToChannel('ordenesFF');
   await getdataSeller('298477234');
  } catch (error) {
    await reiniciarScript();
    console.error('Error en la ejecución principal:', error);
  } finally {
    await redisClient.disconnect();
  }
}

main();