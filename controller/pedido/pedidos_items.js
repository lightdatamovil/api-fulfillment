import { executeQuery } from "lightdata-tools";

class Pedidos_items {
    constructor(
        did = "",
        didPedido = "",
        codigo = "",
        imagen = "",
        descripcion = "",
        ml_id = "",
        dimensions = "",
        cantidad = 0,
        variation_attributes = "",
        seller_sku = "",
        user_product_id = "",
        idVariacion = "",
        descargado = 0,
        superado = 0,
        elim = 0,

        connection = null,
    ) {
        this.did = did;
        this.didPedido = didPedido;
        this.codigo = codigo;
        this.imagen = imagen;
        this.descripcion = descripcion;
        this.ml_id = ml_id;
        this.dimensions = dimensions;
        this.cantidad = cantidad;
        this.variation_attributes = variation_attributes;
        this.seller_sku = seller_sku;
        this.user_product_id = user_product_id;
        this.idVariacion = idVariacion;
        this.descargado = descargado;
        this.superado = superado || 0;
        this.elim = elim || 0;

        this.connection = connection;
    }

    toJSON() {
        return JSON.stringify(this);
    }

    async insert() {
        try {
            return this.checkAndUpdateDidEnvio(this.connection);

        } catch (error) {
            throw {
                status: 500,
                response: {
                    estado: false,
                    error: -1,
                },
            };
        }
    }

    async checkAndUpdateDidEnvio(connection) {
        const checkDidEnvioQuery = 'SELECT id FROM pedidos_items WHERE didOrden = ? and ml_id = ?';

        const results = await executeQuery(connection, checkDidEnvioQuery, [this.didOrden, this.ml_id], true);

        if (results.length > 0) {
            const updateQuery = 'UPDATE pedidos_items SET superado = 1 WHERE didOrden = ? and ml_id = ?';;
            await executeQuery(connection, updateQuery, [this.didOrden, this.ml_id]);

            return this.createNewRecord(connection);
        } else {
            return this.createNewRecord(connection);
        }
    }

    async createNewRecord(connection) {
        const columnsQuery = 'DESCRIBE pedidos_items';
        const results = await executeQuery(connection, columnsQuery, []);

        const tableColumns = results.map((column) => column.Field);
        const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

        const values = filteredColumns.map((column) => this[column]);
        const insertQuery = `INSERT INTO pedidos_items (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;
        const insertResult = await executeQuery(connection, insertQuery, values);

        const insertId = insertResult.insertId;

        return { insertId: insertId };
    }
}
export default Pedidos_items;