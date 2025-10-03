
import { CustomException, executeQuery, Status } from "lightdata-tools"

export class DbUtils {

    // verificar que ya exista un registro, si no existe lanza excepción 404 
    static async verifyExistsAndSelect({ db, table, column, valor, notExist = false, select = '*' }) {
        const sql = `SELECT ${select} FROM ${table} WHERE ${column} = ? and eliminado = 0 LIMIT 1`
        const result = await executeQuery(db, sql, [valor])
        if (!notExist) {
            if (!result.length) {
                throw new CustomException({
                    title: "No encontrado",
                    message: `${column}: ${valor} no encontrado en la tabla ${table}`,
                    status: Status.notFound,
                })
            }
            return result[0]
        } else {
            if (result.length > 0
            ) {
                throw new CustomException({
                    title: "Conflicto",
                    message: `${column}: ${valor} ya existe en la tabla ${table}`,
                    status: Status.conflict,
                })
            }
        }
    }

    // verificar si un valor ya existe en la base de datos, retorna true/false
    static async existsInDb(db, table, column, value) {
        const sql = `SELECT 1 FROM ${table} WHERE ${column} = ? and eliminado = 0 LIMIT 1`
        const result = await executeQuery(db, sql, [value])
        return result.length > 0
    }

    static async eliminarAsignacion(db, table, column, value) {
        const sql = `SET eliminado = 1 FROM ${table} WHERE ${column} = ?`
        const result = await executeQuery(db, sql, [value])
        if (!result || result.affectedRows === 0) {
            throw new CustomException({
                title: "No creado",
                message: `No se pudo realizar la desasignación en ${table}.${column}`,
                status: Status.internal,
            })
        }
        return result.insertId
    }



    /** 
    static async updateAsignacion(table, columnIdPrincipal, idPrincipal, idUpdate) {
        await executeQueryFromPool(poolLightdatito, `SET eliminado = 1 FROM ${table} WHERE id${columnIdPrincipal} = ?`, [idPrincipal])
        const result = sql, [idPrincipal]
        if (!result || result.affectedRows === 0) {
            throw new CustomException({
                title: "No creado",
                message: `No se pudo crear la asignación en ${table}.${column}`,
                status: Status.internal,
            })
        }
        await executeQueryFromPool(poolLightdatito, `INSERT INTO ${table} (${column}) VALUES (?)`, [value])
        return result.insertId
    }

*/
    // verifica si de una lista de ids todos existen en la tabla/columna indicada
    static async ensureAllExist({ db, table, column, ids, label = table }) {
        if (!Array.isArray(ids) || ids.length === 0) return;

        const unique = [...new Set(ids.map(Number))].filter(Number.isFinite);
        if (unique.length === 0) return;

        // Armamos placeholders dinámicos (?, ?, ?, ...)
        const placeholders = unique.map(() => "?").join(",");
        const sql = `SELECT ${column} AS id FROM \`${table}\` WHERE ${column} IN (${placeholders})`;

        const rows = await executeQuery(
            db,
            sql,
            unique, true
        );

        const found = new Set(rows.map(r => Number(r.id)));
        const missing = unique.filter(id => !found.has(Number(id)));

        console.log({ found, missing });

        if (missing.length > 0) {
            throw new CustomException({
                title: `IDs inexistentes en ${label}`,
                message: `No existen en ${table}.${column}: ${missing.join(", ")}`,
                status: Status.badRequest,
            });
        }
    }

}