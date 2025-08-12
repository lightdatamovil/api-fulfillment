import crypto from "crypto";
import { CustomException, executeQuery, Status } from "lightdata-tools";

export async function login(conn, username, password) {

    const query = 'SELECT id, nombre, mail, pass, usuario FROM usuarios WHERE usuario = ? AND elim = 0 AND superado = 0 LIMIT 1';
    const [userRow] = await executeQuery(conn, query, [username]);

    if (!userRow) {
        throw new CustomException({
            title: 'Credenciales inválidas',
            message: 'Email o contraseña incorrectos',
            status: Status.notFound
        });
    }

    const hashPassword = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

    if (userRow.pass !== hashPassword) {
        throw new CustomException({
            title: "Contraseña incorrecta",
            message: "La contraseña ingresada no coincide",
            status: Status.unauthorized
        });
    }
    if (!userRow) {
        throw new CustomException({
            title: 'Credenciales inválidas',
            message: 'Email o contraseña incorrectos',
            status: Status.notFound
        });
    }


    const { id, nombre, email: mail } = userRow;

    return {
        id,
        nombre,
        email: mail,
    };
}
