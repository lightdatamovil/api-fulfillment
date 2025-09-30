import axios from "axios";

export async function obtenerDatosEnvioML(resource, token) {
    const url = `https://api.mercadolibre.com${resource}`;
    const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
    });
    return data?.id ? data : null;
}