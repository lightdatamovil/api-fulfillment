import { executeQuery } from "lightdata-tools";

export async function createNewRecord(dbConnection) {
    const querycheck =
        "SELECT codigo FROM atributos_valores WHERE codigo = ? and superado = 0 and elim = 0";
    const resultscheck = await executeQuery(dbConnection, querycheck, [
        this.codigo,
    ]);

    if (resultscheck.length > 0) {
        return {
            estado: false,
            message: "El codigo del atributo valor ya existe.",
        };
    }
    const columnsQuery = "DESCRIBE atributos_valores";
    const results = await executeQuery(dbConnection, columnsQuery, []);

    const tableColumns = results.map((column) => column.Field);
    const filteredColumns = tableColumns.filter(
        (column) => this[column] !== undefined
    );

    const values = filteredColumns.map((column) => this[column]);
    const insertQuery = `INSERT INTO atributos_valores (${filteredColumns.join(
        ", "
    )}) VALUES (${filteredColumns.map(() => "?").join(", ")})`;

    const insertResult = await executeQuery(dbConnection, insertQuery, values);

    if (this.did == 0 || this.did == null) {
        const updateQuery = "UPDATE atributos_valores SET did = ? WHERE id = ?";
        await executeQuery(dbConnection, updateQuery, [
            insertResult.insertId,
            insertResult.insertId,
        ]);
    }

    return { insertId: insertResult.insertId };
}

