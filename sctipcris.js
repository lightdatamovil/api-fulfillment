const axios = require('axios');


const ACCESS_TOKEN_ML = "APP_USR-3461746997949505-050903-268b7794ec2d373e1a10ea99effaf3d9-746339074";
const USER_ID_ML = "746339074";

const ACCESS_TOKEN_TN = "8ce5a7b08464e124599d67b7159c988fe9c19d71";
const STORE_ID_TN = "1681926";
let Atokens = [];
const token = await getTokenForSeller(sellerid);
async function getTokenForSeller(seller_id) {
  try {
    token = Atokens[seller_id];

    if (token) {
      return token;
    } else {
      return -1;
    }
  } catch (error) {
    console.error("Error al obtener el token de Redis:", error);
    return -1;
  }
}
async function getTokenRedis() {
  try {
    const type = await redisClient.type("token");
    if (type !== "hash") {
      //console.error(La clave 'token' no es un hash, es de tipo: ${type});
      return; // O maneja el error según sea necesario
    }

    const data = await redisClient.hGetAll("token");
    Atokens = data; // Asegúrate de que esto sea lo que necesitas
  } catch (error) {
    console.error("Error al obtener tokens de Redis:", error);
  }
}

async function traerTodosItemsML() {
  let offset = 0;
  const limit = 50;
  const maxItems = 200; // podés subirlo si querés más
  let totalItems = 0;
  const publicaciones = [];

  while (true) {
    const searchUrl = `https://api.mercadolibre.com/users/${USER_ID_ML}/items/search?limit=${limit}&offset=${offset}`;
    const res = await axios.get(searchUrl, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN_ML}` }
    });

    const itemIds = res.data.results;
    if (itemIds.length === 0) break;

    for (const itemId of itemIds) {
      const itemUrl = `https://api.mercadolibre.com/items/${itemId}`;
      const itemRes = await axios.get(itemUrl, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN_ML}` }
      });

      const item = itemRes.data;

      if (item.variations && item.variations.length > 0) {
        item.variations.forEach(v => {
          const material = v.attribute_combinations?.map(attr => `${attr.name}: ${attr.value_name}`).join(' | ') || 'Sin atributos';

          publicaciones.push({
            producto: item.title,
            material,
            id_ml: item.id,
            sku: v.seller_custom_field || '',
            ean: v.attributes?.find(a => a.id === 'EAN')?.value_name || ''
          });
        });
      } else {
        // Item sin variaciones
        publicaciones.push({
          producto: item.title,
          material: 'Sin variaciones',
          id_ml: item.id,
          sku: item.seller_custom_field || '',
          ean: item.attributes?.find(a => a.id === 'EAN')?.value_name || ''
        });
      }

      totalItems++;
      if (totalItems >= maxItems) break;
    }

    offset += limit;
    if (totalItems >= maxItems) break;
  }

  return publicaciones;
}

async function traerTodosItemsTN() {
  const perPage = 50;
  let page = 1;
  const maxItems = 200;
  const publicaciones = [];

  while (true) {
    const url = `https://api.tiendanube.com/v1/${STORE_ID_TN}/products?page=${page}&per_page=${perPage}`;
    const res = await axios.get(url, {
      headers: {
        'Authentication': `bearer ${ACCESS_TOKEN_TN}`,
        'User-Agent': 'Lightdata Fulfillment (info@lightdata.com.ar)'
      }
    });

    const productos = res.data;
    if (productos.length === 0) break;

    for (const p of productos) {
      const titulo = typeof p.name === 'string' ? p.name : p.name?.es || p.name?.default || 'Sin nombre';

      for (const v of p.variants) {
        const material = v.values?.map(val => `${val.name}: ${val.value}`).join(' | ') || 'Sin atributos';

        publicaciones.push({
          producto: titulo,
          material,
          id_tn: v.id,
          sku: v.sku || '',
          ean: v.barcode || ''
        });
      }

      if (publicaciones.length >= maxItems) break;
    }

    page++;
    if (publicaciones.length >= maxItems) break;
  }

  return publicaciones;
}
async function run() {
  const publicacionesML = await traerTodosItemsML();
  const publicacionesTN = await traerTodosItemsTN();

  const agrupados = {};

  [...publicacionesML, ...publicacionesTN].forEach(pub => {
    const key = String(pub.producto || 'sin_nombre').toLowerCase().trim();

    if (!agrupados[key]) {
      agrupados[key] = {
        titulo: pub.producto,
        publicaciones: []
      };
    }

    agrupados[key].publicaciones.push({
      canal: pub.id_ml ? 'ML' : 'TN',
      material: pub.material,
      id: pub.id_ml || pub.id_tn,
      sku: pub.sku,
      ean: pub.ean
    });
  });

  // Mostrar por grupo
  for (const key of Object.keys(agrupados)) {
    const grupo = agrupados[key];
    console.table(grupo.publicaciones.map(pub => ({
      Canal: pub.canal,
      Material: pub.material,
      ID: pub.id,
      SKU: pub.sku,
      EAN: pub.ean
    })));
  }
}


run();
