import { executeQuery } from "lightdata-tools";

export async function createAtributo(dbConnection) {
    const querycheck =
        "SELECT codigo FROM atributos WHERE codigo = ? and superado = 0 and elim = 0";
    const resultscheck = await executeQuery(dbConnection, querycheck, [
        this.codigo,
    ]);
    if (resultscheck.length > 0) {
        return {
            estado: false,
            message: "El codigo del atributo valor ya existe.",
        };
    }
    const columnsQuery = "DESCRIBE atributos";
    const results = await executeQuery(dbConnection, columnsQuery, []);

    const tableColumns = results.map((column) => column.Field);
    const filteredColumns = tableColumns.filter(
        (column) => this[column] !== undefined
    );

    const values = filteredColumns.map((column) => this[column]);
    const insertQuery = `INSERT INTO atributos (${filteredColumns.join(
        ", "
    )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

    const insertResult = await executeQuery(dbConnection, insertQuery, values);

    if (this.did == 0 || this.did == null) {
        const updateQuery = "UPDATE atributos SET did = ? WHERE id = ?";
        await executeQuery(dbConnection, updateQuery, [
            insertResult.insertId,
            insertResult.insertId,
        ]);
    }

    return { insertId: insertResult.insertId };
}