const XLSX = require("xlsx");
const fs = require("fs");

// Función para normalizar strings (por si se necesita para otros campos)
function normalize(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function parseExcelToDidEmpresaPassword(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  const result = data
    .map((row) => {
      const didEmpresa = row.mul;
      const contrasena = row["Contraseña"];

      if (didEmpresa != null && contrasena != null) {
        return { didEmpresa, contrasena };
      }
      return null;
    })
    .filter(Boolean);

  return result;
}

const filePath = "./datos.xlsx";
const resultado = parseExcelToDidEmpresaPassword(filePath);

// Guardar en archivo JSON con cada objeto en una línea
const jsonString = resultado.map((obj) => JSON.stringify(obj)).join(",\n");

fs.writeFileSync("resultado.json", "[\n" + jsonString + "\n]", "utf-8");
