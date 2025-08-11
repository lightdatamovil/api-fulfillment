const axios = require("axios")
const { redisClient } = require("../../dbconfig").default
const { executeQuery } = require("lightdata-tools")

const USER_ID_ML = "746339074"

let Atokens = []

async function getTokenForSeller(seller_id) {
    try {
        const token = Atokens[seller_id]

        if (token) {
            return token
        } else {
            return null
        }
    } catch (error) {
        return null
    }
}

async function getTokenRedis() {
    try {
        const type = await redisClient.type("token")
        if (type !== "hash") {
            return
        }
        const data = await redisClient.hGetAll("token")
        Atokens = data
    } catch (error) {
    }
}

async function getPublicacionesML(pagina = 1, cantidad = 20) {
    await getTokenRedis()

    const sellerId = USER_ID_ML
    const ACCESS_TOKEN_ML = await getTokenForSeller(sellerId)

    if (!ACCESS_TOKEN_ML) {
        throw new Error("No se pudo obtener el token de acceso para Mercado Libre.")
    }

    const offset = (pagina - 1) * cantidad
    const searchUrl = `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=${cantidad}&offset=${offset}`

    try {
        const res = await axios.get(searchUrl, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN_ML}` },
        })

        const itemIds = res.data.results || []
        const publicaciones = []
        const variacionesMap = new Map()

        for (const itemId of itemIds) {
            const itemUrl = `https://api.mercadolibre.com/items/${itemId}?include_attributes=all`
            const itemRes = await axios.get(itemUrl, {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN_ML}` },
            })

            const item = itemRes.data

            publicaciones.push({
                canal: "ML",
                id: item.id,
                producto: item.title,
                seller_custom_field: item.seller_custom_field || null,

                variations: item.variations || [],
                fullItem: item,
            })

            // 🔍 Recolectar atributos de cada variación
            if (Array.isArray(item.variations)) {
                for (const variation of item.variations) {
                    // attribute_combinations
                    if (Array.isArray(variation.attribute_combinations)) {
                        for (const attr of variation.attribute_combinations) {
                            const attrName = attr.name
                            const values = attr.values?.map((v) => v.name) || (attr.value_name ? [attr.value_name] : [])

                            if (!variacionesMap.has(attrName)) {
                                variacionesMap.set(attrName, new Set())
                            }

                            for (const value of values) {
                                variacionesMap.get(attrName).add(value)
                            }
                        }
                    }

                    // attributes
                    if (Array.isArray(variation.attributes)) {
                        for (const attr of variation.attributes) {
                            const attrName = attr.name
                            const values = attr.values?.map((v) => v.name) || (attr.value_name ? [attr.value_name] : [])

                            if (!variacionesMap.has(attrName)) {
                                variacionesMap.set(attrName, new Set())
                            }

                            for (const value of values) {
                                variacionesMap.get(attrName).add(value)
                            }
                        }
                    }
                }
            }
        }

        // 🧩 Convertimos el map a array
        const variacionesItems = Array.from(variacionesMap.entries()).map(([name, valuesSet]) => ({
            name,
            values: Array.from(valuesSet),
        }))

        return {
            estado: true,
            response: {
                totalRegistros: res.data.total || 0,
                totalPaginas: Math.ceil((res.data.total || 0) / cantidad),
                pagina,
                cantidad,
                resultados: publicaciones,
                variacionesItems,
            },
        }
    } catch (error) {
        return {
            estado: false,
            response: {
                totalRegistros: 0,
                totalPaginas: 0,
                pagina,
                cantidad,
                resultados: [],
                variacionesItems: [],
            },
        }
    }
}

const ACCESS_TOKEN_TN = "8ce5a7b08464e124599d67b7159c988fe9c19d71"
const STORE_ID_TN = "1681926"

async function getPublicacionesTN(pagina = 1, cantidad = 20) {
    const url = `https://api.tiendanube.com/v1/${STORE_ID_TN}/products?page=${pagina}&per_page=${cantidad}`

    try {
        const res = await axios.get(url, {
            headers: {
                Authentication: `bearer ${ACCESS_TOKEN_TN}`,
                "User-Agent": "Lightdata Fulfillment (info@lightdata.com.ar)",
            },
        })

        const publicaciones = []

        for (const p of res.data) {
            const titulo = typeof p.name === "string" ? p.name : p.name?.es || p.name?.default || "Sin nombre"

            for (const v of p.variants) {
                publicaciones.push({
                    canal: "TN",
                    producto: titulo,
                    id_producto: p.id,
                    id_variant: v.id,
                    data_variant: v, // ← aquí va la variante completa (cruda)
                })
            }
        }

        return {
            estado: true,
            response: {
                totalRegistros: Number(res.headers["x-total-count"]) || 0,
                totalPaginas: Math.ceil((Number(res.headers["x-total-count"]) || 0) / cantidad),
                pagina,
                cantidad,
                resultados: publicaciones,
            },
        }
    } catch (error) {
        return {
            estado: false,
            response: {
                totalPaginas: null,
                pagina,
                cantidad,
                resultados: [],
            },
        }
    }
}

async function getPublicacionesUnificadas(pagina = 1, cantidad = 20) {
    const [mlData, tnData] = await Promise.all([getPublicacionesML(pagina, cantidad), getPublicacionesTN(pagina, cantidad)])

    const publicacionesUnificadas = []

    // 🔷 Mercado Libre
    const skusML = new Set() // Conjunto para almacenar SKUs de ML
    if (mlData.estado) {
        for (const pub of mlData.response.resultados) {
            for (const variation of pub.variations) {
                const sku = variation.attributes.find((attr) => attr.name === "SKU")?.value_name
                if (sku) {
                    skusML.add(sku) // Agregar SKU al conjunto
                }
            }
        }
    }

    // 🔶 Tienda Nube
    if (tnData.estado) {
        // Agrupar por producto
        const agrupadosTN = {}

        for (const pub of tnData.response.resultados) {
            const skuTN = pub.data_variant.sku // SKU de Tienda Nube

            // Solo agregar si el SKU de TN está en el conjunto de SKUs de ML
            if (skusML.has(skuTN)) {
                if (!agrupadosTN[pub.id_producto]) {
                    agrupadosTN[pub.id_producto] = {
                        titulo: pub.producto,
                        variantes: [],
                    }
                }
                agrupadosTN[pub.id_producto].variantes.push({
                    id: pub.id_variant,
                    nombre: pub.data_variant.values.map((v) => v.es).join(" - ") || "Sin nombre",
                    sku: skuTN,
                })
            }
        }

        // Agregar publicaciones de Mercado Libre que coinciden con los SKUs de Tienda Nube
        for (const pub of mlData.response.resultados) {
            const variantesFiltradas = pub.variations.filter((variation) => {
                const skuML = variation.attributes.find((attr) => attr.name === "SKU")?.value_name
                return skusML.has(skuML)
            })

            if (variantesFiltradas.length > 0) {
                publicacionesUnificadas.push({
                    titulo: pub.producto,
                    variantes: variantesFiltradas.map((v) => ({
                        id: v.id,
                        nombre: v.attribute_combinations?.map((a) => a.value_name).join(" / ") || "Sin nombre",
                        sku: v.attributes.find((attr) => attr.name === "SKU")?.value_name || "",
                    })),
                })
            }
        }

        publicacionesUnificadas.push(...Object.values(agrupadosTN))
    }

    return publicacionesUnificadas
}

async function getPublicacionesMLSimplificado(pagina = 1, cantidad = 20) {
    await getTokenRedis()

    const sellerId = USER_ID_ML
    const ACCESS_TOKEN_ML = await getTokenForSeller(sellerId)

    if (!ACCESS_TOKEN_ML) {
        throw new Error("No se pudo obtener el token de acceso para Mercado Libre.")
    }

    const offset = (pagina - 1) * cantidad
    const searchUrl = `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=${cantidad}&offset=${offset}`

    try {
        const res = await axios.get(searchUrl, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN_ML}` },
        })

        const itemIds = res.data.results || []
        const publicaciones = []

        for (const itemId of itemIds) {
            const itemUrl = `https://api.mercadolibre.com/items/${itemId}?include_attributes=all`
            const itemRes = await axios.get(itemUrl, {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN_ML}` },
            })

            const item = itemRes.data
            //   return item.variations

            // Extraer solo la información necesaria
            publicaciones.push({
                id: item.id,
                producto: item.title,
                precio: item.price,
                estado: item.status,
                sellerId: item.seller_id,
                // Obtener la URL de la imagen
                imagenUrl: item.pictures.length > 0 ? item.pictures[0].url : null,
                atributo: item.variations?.[0]?.attribute_combinations?.[0]?.name || null, // Tomar la primera imagen
                variaciones:
                    item.variations.map((v) => ({
                        id: v.id,
                        nombre: v.attribute_combinations.map((a) => a.value_name).join(" / "),
                        sku: v.attributes.find((attr) => attr.name === "SKU")?.value_name || "Sin SKU",
                    })) || [],
            })
        }

        return {
            estado: true,
            response: {
                totalRegistros: res.data.total || 0,
                totalPaginas: Math.ceil((res.data.total || 0) / cantidad),
                pagina,
                cantidad,
                resultados: publicaciones,
            },
        }
    } catch (error) {
        return {
            estado: false,
            response: {
                totalRegistros: 0,
                totalPaginas: 0,
                pagina,
                cantidad,
                resultados: [],
            },
        }
    }
}

async function getPublicacionesTNSimplificado(pagina = 1, cantidad = 20) {
    const url = `https://api.tiendanube.com/v1/${STORE_ID_TN}/products?page=${pagina}&per_page=${cantidad}`

    try {
        const res = await axios.get(url, {
            headers: {
                Authentication: `bearer ${ACCESS_TOKEN_TN}`,
                "User-Agent": "Lightdata Fulfillment (info@lightdata.com.ar)",
            },
        })

        const publicaciones = []

        for (const p of res.data) {
            const titulo = typeof p.name === "string" ? p.name : p.name?.es || p.name?.default || "Sin nombre"

            for (const v of p.variants) {
                // Construir la URL de la imagen usando el image_id
                const imageUrl = v.image_id ? `https://example.com/images/${v.image_id}` : null // Ajusta la URL base según tu API

                publicaciones.push({
                    canal: "TN",
                    producto: titulo,
                    id_producto: p.id,
                    id_variant: v.id,
                    tienda_id: STORE_ID_TN, // Agregar id de la tienda
                    data_variant: {
                        id: v.id,
                        image_url: imageUrl, // Incluir la URL de la imagen
                        product_id: p.id,
                        price: v.price,
                        weight: v.weight,
                        sku: v.sku,
                        values: v.values,
                        visible: v.visible,
                    },
                })
            }
        }

        return {
            estado: true,
            response: {
                totalRegistros: Number(res.headers["x-total-count"]) || 0,
                totalPaginas: Math.ceil((Number(res.headers["x-total-count"]) || 0) / cantidad),
                pagina,
                cantidad,
                resultados: publicaciones,
            },
        }
    } catch (error) {
        return {
            estado: false,
            response: {
                totalPaginas: null,
                pagina,
                cantidad,
                resultados: [],
            },
        }
    }
}

/*async function unificarPublicaciones(pagina = 1, cantidad = 20) {
    // Obtener publicaciones de Tiendanube
    const publicacionesTN = await getPublicacionesTNSimplificado(pagina, cantidad);
    //  return publicacionesTN
    if (!publicacionesTN.estado) {
        return { estado: false, mensaje: "Error al obtener publicaciones de Tiendanube" };
    }

    // Obtener publicaciones de Mercado Libre
    const publicacionesML = await getPublicacionesMLSimplificado(pagina, cantidad);
    if (!publicacionesML.estado) {
        return { estado: false, mensaje: "Error al obtener publicaciones de Mercado Libre" };
    }

    const publicacionesUnificadas = {};


    // Procesar publicaciones de Tiendanube
    for (const pubTN of publicacionesTN.response.resultados) {
        const variant = pubTN.data_variant; // Acceder directamente a data_variant
        const sku = variant.sku || 'Sin SKU'; // Asegúrate de manejar SKUs vacíos

        if (!publicacionesUnificadas[sku]) {
            publicacionesUnificadas[sku] = {
                titulo: pubTN.producto,
                sku: sku,

                precio: variant.price,
                imagenUrl: variant.image_url,
                variantes: [],
                union: [] // Inicializar union aquí
            };
        }

        // Agregar información de Tiendanube
        const varianteTN = {
            id: pubTN.id_producto,
            image_url: variant.image_url,
            product_id: pubTN.id_producto,
            price: variant.price,
            weight: variant.weight || "0.000", // Manejar peso si está disponible
            sku: variant.sku,
            values: variant.values || [],
            visible: true
        };

        publicacionesUnificadas[sku].variantes.push(varianteTN);

        // Agregar información a union
        publicacionesUnificadas[sku].union.push({
            tipo: 2,
            seller_id: pubTN.tienda_id, // ID de Tiendanube
            idProducto: pubTN.id_producto // SKU de Tiendanube
        });
    }

    // Procesar publicaciones de Mercado Libre
    for (const pubML of publicacionesML.response.resultados) {
        const sku = pubML.variaciones.map(v => v.sku).join(" / ") || 'Sin SKU'; // Asegúrate de manejar SKUs vacíos

        if (!publicacionesUnificadas[sku]) {
            publicacionesUnificadas[sku] = {
                titulo: pubML.producto,
                atributo: pubML.atributo,
                sku: sku,
                precio: pubML.precio,
                atributo: pubML.atributo,
                imagenUrl: pubML.imagenUrl,
                variantes: [],
                union: [] // Inicializar union aquí
            };
        }

        // Agregar información de Mercado Libre
        const varianteML = {
            id: pubML.id,
            image_url: pubML.imagenUrl,
            product_id: pubML.id,
            price: pubML.precio,
            weight: pubML.weight || "0.000", // Manejar peso si está disponible
            sku: pubML.variaciones.map(v => v.sku).join(" / "),
            values: pubML.variaciones.map(v => ({ es: v.value })) || [],
            visible: true
        };

        publicacionesUnificadas[sku].variantes.push(varianteML);

        // Agregar información a union
        publicacionesUnificadas[sku].union.push({
            tipo: 1,
            seller_id: pubML.sellerId, // Seller ID de Mercado Libre
            idProducto: pubML.id // ID de Mercado Libre
        });
    }

    // Convertir el objeto a un arreglo y devolverlo
    const resultadoFinal = Object.values(publicacionesUnificadas);


    return {
        estado: true,
        response: {
            publicaciones: resultadoFinal
        }
    };
}
    */

async function unificarPublicaciones(pagina = 1, cantidad = 20, tn = true, ml = true) {
    const publicacionesUnificadas = {}

    if (tn) {
        const publicacionesTN = await getPublicacionesTNSimplificado(pagina, cantidad)
        if (!publicacionesTN.estado) {
            return { estado: false, mensaje: "Error al obtener publicaciones de Tiendanube" }
        }

        for (const pubTN of publicacionesTN.response.resultados) {
            const variant = pubTN.data_variant
            const sku = variant.sku || "Sin SKU"

            if (!publicacionesUnificadas[sku]) {
                publicacionesUnificadas[sku] = {
                    titulo: pubTN.producto,
                    sku: sku,
                    precio: variant.price,
                    imagenUrl: variant.image_url,
                    variantes: [],
                    union: [],
                }
            }

            const varianteTN = {
                id: pubTN.id_producto,
                image_url: variant.image_url,
                product_id: pubTN.id_producto,
                price: variant.price,
                weight: variant.weight || "0.000",
                sku: variant.sku,
                values: variant.values || [],
                visible: true,
            }

            publicacionesUnificadas[sku].variantes.push(varianteTN)

            publicacionesUnificadas[sku].union.push({
                tipo: 2,
                seller_id: pubTN.tienda_id,
                idProducto: pubTN.id_producto,
            })
        }

        // Si solo se quiere TN, devolver acá
        if (!ml) {
            return {
                estado: true,
                response: {
                    publicaciones: Object.values(publicacionesUnificadas),
                },
            }
        }
    }

    if (ml) {
        const publicacionesML = await getPublicacionesMLSimplificado(pagina, cantidad)
        if (!publicacionesML.estado) {
            return { estado: false, mensaje: "Error al obtener publicaciones de Mercado Libre" }
        }

        for (const pubML of publicacionesML.response.resultados) {
            const sku = pubML.variaciones.map((v) => v.sku).join(" / ") || "Sin SKU"

            if (!publicacionesUnificadas[sku]) {
                publicacionesUnificadas[sku] = {
                    titulo: pubML.producto,
                    atributo: pubML.atributo,
                    sku: sku,
                    precio: pubML.precio,
                    imagenUrl: pubML.imagenUrl,
                    variantes: [],
                    union: [],
                }
            }

            const varianteML = {
                id: pubML.id,
                image_url: pubML.imagenUrl,
                product_id: pubML.id,
                price: pubML.precio,
                weight: pubML.weight || "0.000",
                sku: pubML.variaciones.map((v) => v.sku).join(" / "),
                values: pubML.variaciones.map((v) => ({ es: v.value })) || [],
                visible: true,
            }

            publicacionesUnificadas[sku].variantes.push(varianteML)

            publicacionesUnificadas[sku].union.push({
                tipo: 1,
                seller_id: pubML.sellerId,
                idProducto: pubML.id,
            })
        }
    }

    return {
        estado: true,
        response: {
            publicaciones: Object.values(publicacionesUnificadas),
        },
    }
}

async function construirAtributosConDids(connection) {
    const resultado = []
    const respuesta = await unificarPublicaciones()

    if (!respuesta.estado || !Array.isArray(respuesta.response.publicaciones)) {
        return resultado
    }

    const atributosInput = respuesta.response.publicaciones

    for (const atributo of atributosInput) {
        const nombreAtributo = atributo.atributo || "Sin atributo"
        let didAtributo

        const [atributoExistente] = await executeQuery(connection, "SELECT did FROM atributos WHERE nombre = ? LIMIT 1", [nombreAtributo])

        if (atributoExistente) {
            didAtributo = atributoExistente.did
        } else {
            const [maxAtributo] = await executeQuery(connection, "SELECT MAX(did) AS maxDid FROM atributos", [])
            didAtributo = (maxAtributo?.maxDid || 0) + 1

            await executeQuery(connection, "INSERT INTO atributos (nombre, did) VALUES (?, ?)", [nombreAtributo, didAtributo])
        }

        const variantes = []

        for (const variante of atributo.variantes) {
            if (!Array.isArray(variante.values)) {
                continue
            }

            for (const valor of variante.values) {
                const valorString = valor.es

                if (typeof valorString === "string") {
                    const valorTrimmed = valorString.trim()
                    let didValor

                    const [valorExistente] = await executeQuery(connection, "SELECT did FROM atributos_valores WHERE didAtributo = ? AND valor = ? LIMIT 1", [didAtributo, valorTrimmed])

                    if (valorExistente) {
                        didValor = valorExistente.did
                    } else {
                        const [maxValor] = await executeQuery(connection, "SELECT MAX(did) AS maxDid FROM atributos_valores", [])
                        didValor = (maxValor?.maxDid || 0) + 1

                        await executeQuery(connection, "INSERT INTO atributos_valores (didAtributo, valor, did) VALUES (?, ?, ?)", [didAtributo, valorTrimmed, didValor])
                    }

                    variantes.push({ valor: valorTrimmed, did: didValor })
                }
            }
        }

        resultado.push({
            atributoNombre: nombreAtributo,
            didAtributo,
            variantes,
        })
    }

    return resultado
}

async function construirAtributosYProductosConDids(connection) {
    const resultado = { atributos: [], productos: [] }
    const respuesta = await unificarPublicaciones()

    if (!respuesta.estado || !Array.isArray(respuesta.response.publicaciones)) {
        return resultado
    }

    const publicacionesInput = respuesta.response.publicaciones

    for (const publicacion of publicacionesInput) {
        const nombreAtributo = publicacion.atributo
        if (nombreAtributo) {
            let didAtributo

            const [atributoExistente] = await executeQuery(connection, "SELECT did FROM atributos WHERE nombre = ? LIMIT 1", [nombreAtributo])

            if (atributoExistente) {
                didAtributo = atributoExistente.did
            } else {
                const [maxAtributo] = await executeQuery(connection, "SELECT MAX(did) AS maxDid FROM atributos", [])
                didAtributo = (maxAtributo?.maxDid || 0) + 1

                await executeQuery(connection, "INSERT INTO atributos (nombre, did) VALUES (?, ?)", [nombreAtributo, didAtributo])
            }

            const variantes = []

            if (Array.isArray(publicacion.variantes)) {
                for (const variante of publicacion.variantes) {
                    if (Array.isArray(variante.values)) {
                        for (const valor of variante.values) {
                            const valorString = valor.es

                            if (typeof valorString === "string") {
                                const valorTrimmed = valorString.trim()
                                let didValor

                                const [valorExistente] = await executeQuery(connection, "SELECT did FROM atributos_valores WHERE didAtributo = ? AND valor = ? LIMIT 1", [didAtributo, valorTrimmed])

                                if (!valorExistente) {
                                    const [maxValor] = await executeQuery(connection, "SELECT MAX(did) AS maxDid FROM atributos_valores", [])
                                    didValor = (maxValor?.maxDid || 0) + 1

                                    await executeQuery(connection, "INSERT INTO atributos_valores (didAtributo, valor, did) VALUES (?, ?, ?)", [didAtributo, valorTrimmed, didValor])
                                }

                                variantes.push({ valor: valorTrimmed, did: didValor })
                            }
                        }
                    }
                }
            }

            resultado.atributos.push({
                atributoNombre: nombreAtributo,
                didAtributo,
                variantes,
            })
        }

        const skuProducto = publicacion.sku
        if (skuProducto) {
            const eanProducto = publicacion.ean || null
            const nombreProducto = publicacion.titulo.trim()
            const descripcionProducto = publicacion.descripcion || ""
            const imagenProducto = publicacion.imagen || ""
            const habilitadoProducto = publicacion.habilitado !== undefined ? publicacion.habilitado : true

            const [productoExistente] = await executeQuery(connection, "SELECT did FROM productos WHERE sku = ? LIMIT 1", [skuProducto])

            if (!productoExistente) {
                const [maxProducto] = await executeQuery(connection, "SELECT MAX(did) AS maxDid FROM productos", [])
                const didProducto = (maxProducto?.maxDid || 0) + 1

                await executeQuery(connection, "INSERT INTO productos (did, sku, ean, titulo, descripcion, imagen, habilitado) VALUES (?, ?, ?, ?, ?, ?, ?)", [didProducto, skuProducto, eanProducto, nombreProducto, descripcionProducto, imagenProducto, habilitadoProducto])

                const [productoInsertado] = await executeQuery(connection, "SELECT LAST_INSERT_ID() AS id")

                resultado.productos.push({
                    productoNombre: nombreProducto,
                    didProducto: productoInsertado.id,
                    sku: skuProducto,
                    ean: eanProducto,
                    descripcion: descripcionProducto,
                    imagen: imagenProducto,
                    habilitado: habilitadoProducto,
                })
            }
        }
    }

    return resultado
}
async function construirAtributosDesdePublicaciones(connection) {
    const respuesta = await unificarPublicaciones()
    const ml = await getPublicacionesMLSimplificado()
    const tn = await getPublicacionesTNSimplificado()
    const publicacionesML = ml.response.resultados
    const producto = respuesta.response.publicaciones
    const productosTN = tn.response.resultados

    if (!respuesta.estado || !Array.isArray(respuesta.response.publicaciones)) {
        return { estado: false, response: { atributos: [] } }
    }

    const publicacionesInput = respuesta.response.publicaciones

    const mapaAtributos = new Map()

    const [maxAtributo] = await executeQuery(connection, "SELECT MAX(id) AS maxDid FROM atributos")
    const [maxValor] = await executeQuery(connection, "SELECT MAX(id) AS maxDid FROM atributos_valores")

    let didAtributoSimulado = maxAtributo?.maxDid || 0
    let didValorSimulado = maxValor?.maxDid || 0

    for (const publicacion of publicacionesInput) {
        const nombreAtributo = publicacion.atributo?.trim()

        if (!nombreAtributo) continue

        if (!mapaAtributos.has(nombreAtributo)) {
            let didAtributo
            let variantes = []

            const [atributoExistente] = await executeQuery(connection, "SELECT did FROM atributos WHERE nombre = ? LIMIT 1", [nombreAtributo])

            if (atributoExistente) {
                didAtributo = atributoExistente.did

                const valoresExistentes = await executeQuery(connection, "SELECT valor, did FROM atributos_valores WHERE didAtributo = ?", [didAtributo])

                variantes = valoresExistentes.map((v) => ({
                    valor: v.valor,
                    did: v.did,
                }))
            } else {
                didAtributoSimulado++
                didAtributo = didAtributoSimulado
                variantes = []
            }

            mapaAtributos.set(nombreAtributo, {
                atributoNombre: nombreAtributo,
                didAtributo,
                variantes,
            })
        }

        const atributoActual = mapaAtributos.get(nombreAtributo)
        const variantesActuales = new Set(atributoActual.variantes.map((v) => v.valor))

        if (Array.isArray(publicacion.variantes)) {
            for (const variante of publicacion.variantes) {
                if (Array.isArray(variante.values)) {
                    for (const valorObj of variante.values) {
                        const valorStr = valorObj?.es?.trim()
                        if (!valorStr || variantesActuales.has(valorStr)) continue

                        didValorSimulado++
                        atributoActual.variantes.push({
                            valor: valorStr,
                            did: didValorSimulado,
                        })
                        variantesActuales.add(valorStr)
                    }
                }
            }
        }
    }

    const atributosFinal = Array.from(mapaAtributos.values())

    return {
        variantes: atributosFinal,
        productos: producto,
        p_mercado_libre: publicacionesML,
        p_tienda_nube: productosTN,
    }
}

module.exports = {
    getPublicacionesML,
    getPublicacionesTN,
    getPublicacionesUnificadas,
    getPublicacionesMLSimplificado,
    getPublicacionesTNSimplificado,
    unificarPublicaciones,
    construirAtributosConDids,
    construirAtributosYProductosConDids,
    construirAtributosDesdePublicaciones,
}
