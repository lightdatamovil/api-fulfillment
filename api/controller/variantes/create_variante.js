import { isNonEmpty, number01, LightdataORM, CustomException, Status } from "lightdata-tools";

/**
 * Crea una variante (raíz) y opcionalmente sus categorías y valores.
 * Requiere: codigo, nombre
 * Opcionales: descripcion, habilitado (0/1), orden, categorias: [{ nombre, valores?: [{ nombre, codigo? }] }]
 *
 * Optimizado: inserciones batch.
 */
export async function createVariante(dbConnection, req) {
    const { codigo, nombre, descripcion, habilitado, orden, categorias } = req.body ?? {};
    const userId = Number(req.user?.userId ?? req.user?.id ?? 0) || null;

    // Validaciones mínimas
    if (!isNonEmpty(codigo) || !isNonEmpty(nombre)) {
        throw new CustomException({
            title: "Datos incompletos",
            message: "Los campos 'codigo' y 'nombre' son obligatorios.",
            status: Status.badRequest,
        });
    }

    const codigoTrim = String(codigo).trim();
    const nombreTrim = String(nombre).trim();
    const descTrim = isNonEmpty(descripcion) ? String(descripcion).trim() : null;
    const habValue = number01(habilitado, 1);
    const ordenValue = Number.isFinite(Number(orden)) ? Number(orden) : 0;

    // Unicidad por codigo (misma estrategia que usás en otros handlers)
    const dup = await LightdataORM.select({
        dbConnection,
        table: "variantes",
        where: { codigo: codigoTrim },
        throwIfNotExists: false,
        limit: 1,
    });
    if (Array.isArray(dup) && dup.length > 0) {
        throw new CustomException({
            title: "Código duplicado",
            message: `Ya existe una variante con código '${codigoTrim}'`,
            status: Status.conflict,
        });
    }

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
        ? categorias.filter((c) => isNonEmpty(c?.nombre))
        : [];

    // Si no hay categorías, devolvemos con id de variante
    if (cats.length === 0) {
        return {
            success: true,
            message: "Variante creada correctamente (sin categorías)",
            data: { did: idVariante },
            meta: { timestamp: new Date().toISOString() },
        };
    }

    // Inserta categorías en batch
    const catRows = cats.map((cat) => ({
        did_variante: idVariante,
        nombre: String(cat.nombre ?? "").trim(),
    }));

    /** @type {number[]} */
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
            ? cat.valores.filter((v) => isNonEmpty(v?.nombre))
            : [];

        return valores.map((v) => ({
            // columnas según tu uso previo
            did_categoria: didCategoria,                         // id de la categoría
            codigo: isNonEmpty(v?.codigo) ? String(v.codigo).trim() : null,
            nombre: String(v.nombre ?? "").trim(),
        }));
    });

    /** @type {number[]|undefined} */
    let idVals;
    if (valoresRows.length > 0) {
        idVals = await LightdataORM.insert({
            dbConnection,
            table: "variantes_categoria_valores",
            quien: userId,
            data: valoresRows,
        });
    }

    return {
        success: true,
        message: "Variante creada correctamente",
        data: {
            did: idVariante,
            categorias: idCats.map((did, i) => ({
                did,
                nombre: catRows[i].nombre,
            })),
            valores: Array.isArray(idVals)
                ? idVals.map((did, i) => ({
                    did,
                    did_categoria: valoresRows[i].did_categoria,
                    codigo: valoresRows[i].codigo,
                    nombre: valoresRows[i].nombre,
                }))
                : [],
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
