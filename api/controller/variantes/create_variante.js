import { isNonEmpty, number01, LightdataORM } from "lightdata-tools";

/**
 * Crea una variante (raíz) y opcionalmente sus categorías y valores.
 * Requiere: codigo, nombre
 * Opcionales: descripcion, habilitado (0/1), orden, categorias: [{ nombre, valores?: [{ nombre }] }]
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

    await LightdataORM.select({
        dbConnection,
        table: "variantes",
        where: { codigo: codigoTrim },
        throwIfExists: true,
    });

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

    const cats = Array.isArray(categorias) ? categorias.filter(c => isNonEmpty(c?.nombre)) : [];

    const catRows = cats.map(cat => ({
        did_variante: idVariante,
        nombre: String(cat.nombre ?? "").trim(),
    }));

    await LightdataORM.insert({
        dbConnection,
        table: "variantes_categorias",
        quien: userId,
        data: catRows,
    });

    return {
        success: true,
        message: "Variante creada correctamente",
        meta: { timestamp: new Date().toISOString() },
    };
}
