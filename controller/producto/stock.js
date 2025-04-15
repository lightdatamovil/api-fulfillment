const { getConnection, executeQuery } = require('../../dbconfig');

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
            if (this.did === null || this.did === "") {
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


            const updateQuery = 'UPDATE stock SET did = ? WHERE id = ?';
            await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);
            return { insertId: insertResult.insertId };
        } catch (error) {
            throw error;
        }
    }

    async updateExistingRecord(connection) {
        try {
            const updateQuery = 'UPDATE stock SET cantidad = ?, quien = ?, superado = ?, elim = ? WHERE did = ?';
            await executeQuery(connection, updateQuery, [this.cantidad, this.quien, this.superado, this.elim, this.did]);
            return { estado: true, message: "Stock actualizado correctamente." };
        } catch (error) {
            throw error;
        }
    }

    async delete(connection, did) {
        try {
            const deleteQuery = 'UPDATE stock SET elim = 1 WHERE did = ?';
            await executeQuery(connection, deleteQuery, [did]);
            return {
                estado: true,
                message: "Stock eliminado correctamente."
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Stock;
