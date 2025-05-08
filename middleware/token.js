const crypto = require("crypto");

function generateToken(dateString) {
  return crypto.createHash("sha256").update(dateString).digest("hex");
}
// middleware/auth.js
const jwt = require("jsonwebtoken");

const SECRET_KEY = "tu_clave_secreta";

function verificarToken(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ mensaje: "Token no proporcionado" });
  }

  const tokenLimpio = token.replace("Bearer ", "");

  jwt.verify(tokenLimpio, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ mensaje: "Token inválido" });
    }

    const { idEmpresa, quien } = decoded;

    // Asegurar que el body exista y sea un objeto
    if (!req.body) req.body = {};

    // Sobreescribe o agrega el campo 'quien' en el body con el valor del token
    req.body.quien = quien;

    // También podés verificar la empresa como antes
    const bodyIdEmpresa = req.body.idEmpresa;
    if (idEmpresa !== bodyIdEmpresa) {
      return res.status(403).json({
        mensaje: "Permisos insuficientes: los datos no coinciden con el token",
      });
    }

    req.usuario = decoded;
    next();
  });
}

module.exports = verificarToken;
