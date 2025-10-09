import crypto from "crypto";
import { CustomException, executeQuery, generateToken, Status } from "lightdata-tools";

export async function loginApp(dbConnection, req) {
    const { username, password, companyId } = req.body ?? {};

    if (!username || !password) {
        throw new CustomException({
            title: "Faltan credenciales",
            message: "Usuario y contraseña son obligatorios",
            status: Status.badRequest,
        });
    }

    const userSql = `
        SELECT did, perfil, nombre, apellido, email, pass, usuario
        FROM usuarios
        WHERE usuario = ? AND elim = 0 AND superado = 0
        LIMIT 1
    `;
    const users = await executeQuery(dbConnection, userSql, [username]);
    const user = users[0];

    const invalid = () =>
        new CustomException({
            title: "Credenciales inválidas",
            message: "Usuario o contraseña incorrectos",
            status: Status.unauthorized,
        });

    if (!user) throw invalid();

    const inputHash = crypto.createHash("sha256").update(password).digest("hex").toLowerCase();
    const dbHash = String(user.pass).toLowerCase();

    const sameLength = dbHash.length === inputHash.length && dbHash.length > 0;
    if (!sameLength) throw invalid();
    const ok = crypto.timingSafeEqual(
        Buffer.from(dbHash, "utf8"),
        Buffer.from(inputHash, "utf8")
    );
    if (!ok) throw invalid();

    const jwtSecret = process.env.JWT_SECRET;
    const token = generateToken(jwtSecret, {
        companyId: companyId,
        userId: user.did,
        profile: user.perfil,
    }, {}, 3600 * 8);

    return {
        success: true,
        message: "Inicio de sesión exitoso",
        data: {
            did: user.did,
            perfil: user.perfil,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            username: user.usuario,
            token: token,
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}
