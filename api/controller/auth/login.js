import crypto from "crypto";
import { CustomException, executeQuery, generateToken, Status } from "lightdata-tools";
import { companiesService, jwtAudience, jwtIssuer, jwtSecret } from "../../db.js";

export async function login(dbConnection, req) {
    const { username, password, companyCode } = req.body;

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
    const dbHash = String(user.pass || "").toLowerCase();

    const sameLength = dbHash.length === inputHash.length && dbHash.length > 0;
    if (!sameLength) throw invalid();
    const ok = crypto.timingSafeEqual(
        Buffer.from(dbHash, "utf8"),
        Buffer.from(inputHash, "utf8")
    );
    if (!ok) throw invalid();

    const company = await companiesService.getByCode(companyCode);
    console.log(`company: ${company}`);


    const token = generateToken({
        jwtSecret: jwtSecret,
        issuer: jwtIssuer,
        audience: jwtAudience,
        payload: {
            companyId: company.did,
            userId: user.did,
            profile: user.perfil,
        },
        options: {},
        expiresIn: 3600 * 8,
    });



    //aagregado de tabla sistema_empresa
    const sistemaData = await executeQuery(dbConnection, `SELECT codigo, nombre, modo_trabajo, tipo, imagen FROM sistema_empresa WHERE did = ? AND superado = 0 and elim = 0`, [company.did], true);
    console.log(sistemaData);


    return {
        success: true,
        message: "Inicio de sesión exitoso",
        data: {
            user: {
                did: user.did,
                perfil: user.perfil,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                username: user.usuario,
                token: token,
            },
            company: {
                codigo: company.codigo,
                did: company.did,
                nombre: sistemaData[0].nombre || null,
                tipo: company.tipo,
                imagen: sistemaData[0].imagen || null,
                modo_trabajo: sistemaData[0].modo_trabajo
            }
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}
