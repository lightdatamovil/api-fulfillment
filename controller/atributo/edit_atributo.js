import { executeQuery } from "lightdata-tools";

export async function editAtributo(dbConnection) {
    const checkDidProductoQuery = "SELECT id FROM atributos WHERE did = ?";
    const results = await executeQuery(dbConnection, checkDidProductoQuery, [
        this.did,
    ]);

    if (results.length > 0) {

        const updateQuery = "UPDATE atributos SET superado = 1 WHERE did = ?";
        await executeQuery(dbConnection, updateQuery, [this.did]);
        return this.createNewRecord(dbConnection);
    } else {
        return this.createNewRecord(dbConnection);
    }
}