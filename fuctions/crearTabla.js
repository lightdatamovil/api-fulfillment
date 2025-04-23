async function createTables(connection) {
    try {
     

        console.log("✅ Tablas verificadas y creadas.");
    } catch (error) {
        console.error("❌ Error al crear las tablas:", error);
        throw error;
    }
}

module.exports = { createTables };
