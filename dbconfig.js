const mysql = require("mysql");
const redis = require("redis");
const { logYellow, logRed } = require("./fuctions/logsCustom");
const { createTables } = require("./fuctions/crearTabla");
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

(async () => {
  await redisClient.connect();
  console.log("Redis conectado");
})();
let companiesList = {};


async function getConnectionLocal(idempresa) {
  try {
    console.log("idempresa recibido:", idempresa);

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




async function executeQuery(connection, query, values, log = false) {
  if (log) {
    logYellow(`Ejecutando query: ${query} con valores: ${values}`);
  }
  try {
    return new Promise((resolve, reject) => {
      connection.query(query, values, (err, results) => {
        if (err) {
          if (log) {
            logRed(`Error en executeQuery: ${err.message}`);
          }
          reject(err);
        } else {
          if (log) {
            logYellow(`Query ejecutado con éxito: ${JSON.stringify(results)}`);
          }
          resolve(results);
        }
      });
    });
  } catch (error) {
    log(`Error en executeQuery: ${error.message}`);
    throw error;
  }
}


module.exports = {
  getConnectionLocal,
  redisClient,
  executeQuery,
};
