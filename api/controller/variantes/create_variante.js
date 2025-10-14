import { isNonEmpty, number01, LightdataORM } from "lightdata-tools";

/**
 * Crea una variante (raíz) y opcionalmente sus categorías y valores.
 * Requiere: codigo, nombre
 * Opcionales: descripcion, habilitado (0/1), orden, categorias: [{ nombre, valores?: [{ nombre, codigo? }] }]
 *
 * 🔹 Optimizado: sin bucles for — usa inserciones batch.
 */
export async function createVariante(dbConnection, req) {
    const { codigo, nombre, descripcion, habilitado, orden, categorias } = req.body;
    const userId = Number(req.user?.userId ?? req.user?.id ?? 0) || null;

    const codigoTrim = String(codigo ?? "").trim();
    const nombreTrim = String(nombre ?? "").trim();
    const descTrim = isNonEmpty(descripcion) ? String(descripcion).trim() : null;
    const habValue = number01(habilitado, 1);
    const ordenValue = Number.isFinite(Number(orden)) ? Number(orden) : 0;

    // Unicidad por codigo
    await LightdataORM.select({
        dbConnection,
        table: "variantes",
        where: { codigo: codigoTrim },
        throwIfExists: true,
    });

    // Inserta variante y toma id
    const [idVariante] = await LightdataORM.insert({
        dbConnection,
        table: "variantes",
        quien: userId,
        data: {
            codigo: codigoTrim,
            nombre: nombreTrim,
            descripcion: descTrim,
            orden: ordenValue,
            habilitado: habValue,
        },
    });

    // Normaliza categorías
    const cats = Array.isArray(categorias)
        ? categorias.filter(c => isNonEmpty(c?.nombre))
        : [];

    // Si no hay categorías, fin
    if (cats.length === 0) {
        return {
            success: true,
            message: "Variante creada correctamente (sin categorías)",
            meta: { timestamp: new Date().toISOString() },
        };
    }

    // Inserta categorías en batch
    const catRows = cats.map(cat => ({
        did_variante: idVariante,
        nombre: String(cat.nombre ?? "").trim(),
    }));

    // Devuelve un array de IDs en el mismo orden que catRows
    const idCats = await LightdataORM.insert({
        dbConnection,
        table: "variantes_categorias",
        quien: userId,
        data: catRows,
    });

    // Aplana valores -> filas para variantes_categoria_valores
    const valoresRows = cats.flatMap((cat, idx) => {
        const didCategoria = idCats[idx];
        const valores = Array.isArray(cat.valores)
            ? cat.valores.filter(v => isNonEmpty(v?.nombre))
            : [];

        return valores.map(v => ({
            // columnas según el schema de variantes_categoria_valores
            did: idVariante,                                 // id de la variante
            did_categoria: didCategoria,                     // id de la categoría
            codigo: isNonEmpty(v?.codigo) ? String(v.codigo).trim() : null,
            nombre: String(v.nombre ?? "").trim(),
        }));
    });

    if (valoresRows.length > 0) {
        await LightdataORM.insert({
            dbConnection,
            table: "variantes_categoria_valores",
            quien: userId,
            data: valoresRows,
        });
    }

    return {
        success: true,
        message: "Variante creada correctamente",
        meta: { timestamp: new Date().toISOString() },
    };
}
