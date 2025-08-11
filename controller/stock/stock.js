const StockConsolidado = require('./stock_consolidado');

class Stock {
    constructor(
        did = "",
        didProducto = 0,
        didVariante = 0,
        cantidad = 0,
        quien = 0,
        superado = 0,
        elim = 0,
        connection = null
    ) {
        this.did = did;
        this.didProducto = didProducto || 0;
        this.didVariante = didVariante || 0;
        this.cantidad = cantidad || 0;
        this.quien = quien || 0;
        this.superado = superado;
        this.elim = elim;
        this.connection = connection;
        this.autofecha = new Date(); // Timestamp por defecto
    }

    toJSON() {
        return JSON.stringify(this);
    }

    async insert() {
        try {
            if (this.did === null || this.did === "" || this.did === undefined || this.did === 0) {
                return this.createNewRecord(this.connection);
            } else {
                return this.updateExistingRecord(this.connection);
            }
        } catch (error) {
            console.error("Error en el método insert:", error.message);
            throw {
                status: 500,
                response: {
                    estado: false,
                    error: -1,
                },
            };
        }
    }

    async createNewRecord(connection) {
        try {
            const columnsQuery = 'DESCRIBE stock';
            const results = await executeQuery(connection, columnsQuery, []);

            const tableColumns = results.map((column) => column.Field);
            const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

            const values = filteredColumns.map((column) => this[column]);
            const insertQuery = `INSERT INTO stock (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;

            const insertResult = await executeQuery(connection, insertQuery, values);

            // Asignar el did como el insertId (si usás eso como identificador único)
            const updateQuery = 'UPDATE stock SET did = ? WHERE id = ?';
            await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);

            // ----------------------
            // Lógica de Consolidado
            // ----------------------

            // Paso 1: Obtener stock anterior no superado
            const selectQuery = `
                SELECT stock 
                FROM stock_consolidado 
                WHERE didProducto = ? AND didVariante = ? AND superado = 0 AND elim = 0
                ORDER BY id DESC 
                LIMIT 1
            `;
            const [lastConsolidado] = await executeQuery(connection, selectQuery, [this.didProducto, this.didVariante]);
            const stockAnterior = lastConsolidado ? lastConsolidado.stock : 0;

            // Paso 2: Marcar el stock anterior como superado
            if (lastConsolidado) {
                const markSuperadoQuery = `
                    UPDATE stock_consolidado 
                    SET superado = 1 
                    WHERE didProducto = ? AND didVariante = ? AND superado = 0 AND elim = 0
                `;
                await executeQuery(connection, markSuperadoQuery, [this.didProducto, this.didVariante]);
            }

            // Paso 3: Calcular nuevo stock consolidado y guardar
            const nuevoStock = stockAnterior + this.cantidad;

            const stockConsolidado = new StockConsolidado(
                0,
                this.didProducto,
                this.didVariante,
                nuevoStock,
                this.quien,
                0,
                0,
                connection
            );

            await stockConsolidado.insert();

            return { insertId: insertResult.insertId };

        } catch (error) {
            console.error("Error en createNewRecord:", error.message);
            throw error;
        }
    }

    async updateExistingRecord(connection) {
        const updateQuery = 'UPDATE stock SET cantidad = ?, quien = ?, superado = ?, elim = ? WHERE did = ?';
        await executeQuery(connection, updateQuery, [this.cantidad, this.quien, this.superado, this.elim, this.did]);
        return { estado: true, message: "Stock actualizado correctamente." };
    }

    async delete(connection, did) {
        const deleteQuery = 'UPDATE stock SET elim = 1 WHERE did = ?';
        await executeQuery(connection, deleteQuery, [did]);
        return {
            estado: true,
            message: "Stock eliminado correctamente."
        };
    }
}

module.exports = Stock;
