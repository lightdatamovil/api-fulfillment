import { executeQuery } from "lightdata-tools";

export async function checkAndUpdateDidProducto(connection) {
  const checkDidProductoQuery =
    "SELECT id FROM atributos_valores WHERE did = ?";
  const results = await executeQuery(connection, checkDidProductoQuery, [
    this.did,
  ]);

  if (results.length > 0) {
    const updateQuery =
      "UPDATE atributos_valores SET superado = 1 WHERE did = ?";

    await executeQuery(connection, updateQuery, [this.did]);

    const querydel =
      "select * from atributos_valores where didAtributo  = ? and superado = 0 and elim = 0";

    const results = await executeQuery(connection, querydel, [
      this.didAtributo,
    ]);

    if (results.length > 0) {
      for (const row of results) {
        await this.delete(connection, row.did);
      }
    }
    return this.createNewRecord(connection);
  } else {
    return this.createNewRecord(connection);
  }
}