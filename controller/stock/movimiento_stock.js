const { executeQuery } = require('../../dbconfig');
const Stock = require('./stock');
class MovimientoStock {
    constructor(
        did = "",
        data = [], // Ahora recibimos un arreglo de objetos en vez de un string JSON
        quien = 0,
        superado = 0,
        elim = 0,
        connection = null
    ) {
        this.did = did;
        this.data = data; // Ahora `data` es un arreglo de objetos
        this.quien = quien || 0;
        this.superado = superado;
        this.elim = elim;
        this.connection = connection;
        this.autofecha = new Date();
    }

    toJSON() {
        return JSON.stringify(this);
    }

    async insert() {
        try {
            const insertResult = await this.createNewRecord(this.connection);
            console.log("✅ Insertado lote de movimiento_stock con ID:", insertResult.insertId);

            for (const mov of this.data) {


                const stock = new Stock(
                    0,
                    mov.didProducto,
                    mov.didVariante,
                    mov.cantidad,
                    mov.quien || this.quien,
                    0,
                    0,
                    this.connection
                );

                await stock.insert();

            }



            return { estado: true, insertId: insertResult.insertId };
        } catch (error) {
            console.error("❌ Error en insert:", error.message);
            throw {
                status: 500,
                response: {
                    estado: false,
                    error: -1,
                    detalle: error.message || error,
                },
            };
        }
    }


    async createNewRecord(connection) {
        const columnsQuery = 'DESCRIBE movimientos_stock';
        const results = await executeQuery(connection, columnsQuery, []);
        const tableColumns = results.map((column) => column.Field);

        // Creamos copia de datos para insertar
        const tempData = {};

        for (const column of tableColumns) {
            if (this[column] !== undefined) {
                if (column === 'data') {
                    tempData[column] = JSON.stringify(this.data); // no modificamos this.data original
                } else {
                    tempData[column] = this[column];
                }
            }
        }

        const filteredColumns = Object.keys(tempData);
        const values = Object.values(tempData);

        const insertQuery = `INSERT INTO movimientos_stock (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
        const insertResult = await executeQuery(connection, insertQuery, values);

        const updateQuery = 'UPDATE movimientos_stock SET did = ? WHERE id = ?';
        await executeQuery(connection, updateQuery, [insertResult.insertId, insertResult.insertId]);

        return { insertId: insertResult.insertId };
    }

    async update() {
        try {
            const updateQuery = 'UPDATE movimientos_stock SET superado = 1 WHERE did = ?';
            await executeQuery(this.connection, updateQuery, [this.did]);
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
}

module.exports = MovimientoStock;
