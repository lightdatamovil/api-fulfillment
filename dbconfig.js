const mysql = require('mysql');
const redis = require('redis');
const {logYellow,logRed} = require ("./fuctions/logsCustom");
const { createTables } = require('./fuctions/crearTabla');
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

(async () => {
    await redisClient.connect();
    console.log('Redis conectado');
})();
let companiesList = {};
async function getConnection(idempresa) {
    try {
        console.log("idempresa recibido:", idempresa);

        // Validación del tipo de idempresa
        if (typeof idempresa !== 'string' && typeof idempresa !== 'number') {
            throw new Error(`idempresa debe ser un string o un número, pero es: ${typeof idempresa}`);
        }

        // Obtener las empresas desde Redis
        const redisKey = 'empresasData';
        const empresasData = await getFromRedis(redisKey);
        if (!empresasData) {
            throw new Error(`No se encontraron datos de empresas en Redis.`);
        }

       // console.log("Datos obtenidos desde Redis:", empresasData);

        // Buscar la empresa por su id
        const empresa = empresasData[String(idempresa)];
        if (!empresa) {
            throw new Error(`No se encontró la configuración de la empresa con ID: ${idempresa}`);
        }

       // console.log("Configuración de la empresa encontrada:", empresa);

        // Configurar la conexión a la base de datos
        const config = {
            host: 'bhsmysql1.lightdata.com.ar',  // Host fijo
            database: empresa.dbname,           // Base de datos desde Redis
            user: empresa.dbuser,               // Usuario desde Redis
            password: empresa.dbpass,           // Contraseña desde Redis
        };
      /*  const config = {
            host: 'localhost',  // Host fijo
            database: "logisticaa",           // Base de datos desde Redis
            user: "logisticaA",               // Usuario desde Redis
            password: "logisticaa",           // Contraseña desde Redis
     } */    
            console.log("Configuración de la conexión:", config);

        return mysql.createConnection(config);
    } catch (error) {
        console.error(`Error al obtener la conexión:`, error.message);

        // Lanza un error con una respuesta estándar
        throw {
            status: 500,
            response: {
                estado: false,
              
                error: -1,
             
            },
        };
    }
}



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
            user: 'root',
            password: 'Ve5P4nAdt6UiT8',
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

        // Crear tablas si no existen
        await createTables(dbConnection);

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



// Función para obtener datos desde Redis
async function getFromRedis(key) {
    try {
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.error(`Error obteniendo clave ${key} de Redis:`, error);
        throw {
            status: 500,
            response: {
                estado: false,
              
                error: -1
              
            },
        };
    }
}

 function getProdDbConfig(company) {
    return {
        host: "bhsmysql1.lightdata.com.ar",
        user: company.dbuser,
        password: company.dbpass,
        database: company.dbname
    };
}

async function loadCompaniesFromRedis() {
    try {
        const companiesListString = await redisClient.get('empresasData');

        companiesList = JSON.parse(companiesListString);

    } catch (error) {
        logRed(`Error en loadCompaniesFromRedis: ${error.message}`);
        throw error;
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
 async function getCompanyById(companyId) {
    try {
        let company = companiesList[companyId];

        if (company == undefined || Object.keys(companiesList).length === 0) {
            try {
                await loadCompaniesFromRedis();

                company = companiesList[companyId];
            } catch (error) {
                logRed(`Error al cargar compañías desde Redis: ${error.stack}`);
                throw error;
            }
        }

        return company;
    } catch (error) {
        logRed(`Error en getCompanyById: ${error.stack}`);
        throw error;
    }
}

module.exports = { getConnectionLocal, getFromRedis, redisClient, getProdDbConfig, executeQuery, getCompanyById };
