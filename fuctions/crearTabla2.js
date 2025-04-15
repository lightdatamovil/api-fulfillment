const mysql = require("mysql2/promise");

async function setupEmpresaDB(idEmpresa, nombreUsuario, claveUsuario) {
    const dbName = `empresa_${idEmpresa}`;
    const user = nombreUsuario;
    const password = claveUsuario;

    // Conexión inicial como root o un superusuario
    const adminConnection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'tu_contraseña_root'
    });

    try {
        // Crear base de datos si no existe
        await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

        // Crear el usuario si no existe
        await adminConnection.query(`CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${password}'`);

        // Darle permisos al usuario solo sobre su base
        await adminConnection.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${user}'@'localhost'`);

        await adminConnection.query(`FLUSH PRIVILEGES`);
        console.log(`✅ Base de datos ${dbName} y usuario ${user} creados/configurados.`);
    } catch (error) {
        console.error("❌ Error al configurar base de datos y usuario:", error);
        throw error;
    } finally {
        await adminConnection.end();
    }

    // Conexión ya con el usuario de la empresa para crear sus tablas
    const empresaConnection = await mysql.createConnection({
        host: 'localhost',
        user,
        password,
        database: dbName
    });

    return empresaConnection;
}
