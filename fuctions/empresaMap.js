
const fs = require('fs');
const path = require('path');

const EMPRESAS_MAP_PATH = path.join(__dirname, '../empresasMap.json');

function cargarEmpresasMap() {
  try {
    if (fs.existsSync(EMPRESAS_MAP_PATH)) {
      const data = fs.readFileSync(EMPRESAS_MAP_PATH, 'utf8');
      global.empresasCodigos = JSON.parse(data);
    } else {
      global.empresasCodigos = {};
    }
  } catch (err) {
    console.error('Error al cargar empresasMap.json:', err.message);
    global.empresasCodigos = {};
  }
}

function guardarEmpresasMap() {
  try {
    fs.writeFileSync(
      EMPRESAS_MAP_PATH,
      JSON.stringify(global.empresasCodigos, null, 2)
    );
  } catch (err) {
    console.error('Error al guardar empresasMap.json:', err.message);
  }
}

module.exports = {
  cargarEmpresasMap,
  guardarEmpresasMap
};
