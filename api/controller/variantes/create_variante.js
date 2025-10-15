import { isNonEmpty, number01, LightdataORM } from "lightdata-tools";

/**
 * Crea una variante (raíz) y opcionalmente sus categorías y valores.
 * Requiere: codigo, nombre
 * Opcionales: descripcion, habilitado (0/1), orden, categorias: [{ nombre, valores?: [{ nombre, codigo? }] }]
 *
 * Optimizado: inserciones batch.
 */
export async function createVariante(dbConnection, req) {
    const { codigo, nombre, descripcion, habilitado, orden, categorias } = req.body;
    const userId = Number(req.user.userId);

    const codigoTrim = String(codigo).trim();
    const nombreTrim = String(nombre).trim();
    const descTrim = isNonEmpty(descripcion) ? String(descripcion).trim() : null;
    const habValue = number01(habilitado, 1);
    const ordenValue = Number.isFinite(Number(orden)) ? Number(orden) : 0;

    await LightdataORM.select({
        dbConnection,
        table: "variantes",
        where: { codigo: codigoTrim },
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

    const cats = Array.isArray(categorias)
        ? categorias.filter((c) => isNonEmpty(c?.nombre))
        : [];

    if (cats.length === 0) {
        return {
            success: true,
            message: "Variante creada correctamente (sin categorías)",
            data: { did: idVariante },
            meta: { timestamp: new Date().toISOString() },
        };
    }

    const catRows = cats.map((cat) => ({
        did_variante: idVariante,
        nombre: String(cat.nombre ?? "").trim(),
    }));

    const idCats = await LightdataORM.insert({
        dbConnection,
        table: "variantes_categorias",
        quien: userId,
        data: catRows,
    });

    const valoresRows = cats.flatMap((cat, idx) => {
        const didCategoria = idCats[idx];
        const valores = Array.isArray(cat.valores)
            ? cat.valores.filter((v) => isNonEmpty(v?.nombre))
            : [];

        return valores.map((v) => ({
            did_categoria: didCategoria,
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
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
