const { executeQuery } = require('../../dbconfig');

class StockConsolidado {
    constructor(
        did = "",
        didProducto = 0,
        didVariante = 0,
        stock = 0,
        quien = 0,
        superado = 0,
        elim = 0,
        connection = null
    ) {
        this.did = did;
        this.didProducto = didProducto || 0;
        this.didVariante = didVariante || 0;
        this.stock = stock || 0;
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
            return await this.createNewRecord(this.connection);
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
            const columnsQuery = 'DESCRIBE stock_consolidado';
            const results = await executeQuery(connection, columnsQuery, []);

            const tableColumns = results.map((column) => column.Field);
            const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

            const values = filteredColumns.map((column) => this[column]);
            const insertQuery = `INSERT INTO stock_consolidado (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;


            const insertResult = await executeQuery(connection, insertQuery, values);
            const updateQuery = 'UPDATE stock_consolidado SET did = ? WHERE id = ?';
            await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
            return { insertId: insertResult.insertId };
        } catch (error) {
            throw error;
        }
    }


    async update() {
        try {
            const updateQuery = 'UPDATE stock_consolidado SET superado = 1 WHERE didProducto = ? AND didVariante = ?';
            await executeQuery(this.connection, updateQuery, [this.stock, this.id]);
        } catch (error) {
            console.error("Error en el método update:", error.message);
            throw {
                status: 500,
                response: {
                    estado: false,
                    error: -1,
                },
            };
        }

    }

    async consolidateStock(previousStock) {
        this.stock = previousStock; // Asignar el stock anterior
        return await this.insert(); // Insertar en stock_consolidado
    }
}

module.exports = StockConsolidado;
