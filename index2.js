const crypto = require("crypto");

function generateSpecificHash(password) {
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  return hash;
}

// Contraseña original
const password = "alett1234";
const generatedHash = generateSpecificHash(password);
console.log("Hash generado:", generatedHash);
