import { isNonEmpty, number01, LightdataORM, executeQuery } from "lightdata-tools";

export async function addStock({ db, req }) {
    const { codigo, nombre, descripcion, habilitado, orden, categorias } = req.body;
    const userId = Number(req.user.userId);

    const codigoTrim = String(codigo).trim();
    const nombreTrim = String(nombre).trim();
    const descTrim = isNonEmpty(descripcion) ? String(descripcion).trim() : null;
    const habValue = number01(habilitado, 1);
    const ordenValue = Number.isFinite(Number(orden)) ? Number(orden) : 0;

    await LightdataORM.select({
        db,
        table: "variantes",
        where: { codigo: codigoTrim },
        select: ["id"],
        throwIfExists: true,
    })

    const [idVariante] = await LightdataORM.insert({
        db,
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

    let idCats = [];
    if (cats.length > 0) {
        const catRows = cats.map((cat) => ({
            did_variante: idVariante,
            nombre: String(cat.nombre ?? "").trim(),
        }));

        idCats = await LightdataORM.insert({
            db,
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
                db,
                table: "variantes_categoria_valores",
                quien: userId,
                data: valoresRows,
            });
        }
    }

    const sql = `
        SELECT 
            v.id AS variante_id,
            v.did AS variante_did,
            v.codigo AS variante_codigo,
            v.nombre AS variante_nombre,
            v.descripcion AS variante_descripcion,
            v.habilitado AS variante_habilitado,
            v.orden AS variante_orden,
            vc.id AS categoria_id,
            vc.did AS categoria_did,
            vc.nombre AS categoria_nombre,
            vcv.id AS valor_id,
            vcv.did AS valor_did,
            vcv.codigo AS valor_codigo,
            vcv.nombre AS valor_nombre
        FROM variantes v
        LEFT JOIN variantes_categorias vc 
            ON vc.did_variante = v.did AND vc.superado = 0 AND vc.elim = 0
        LEFT JOIN variantes_categoria_valores vcv 
            ON vcv.did_categoria = vc.did AND vcv.superado = 0 AND vcv.elim = 0
        WHERE v.id = ?
          AND v.superado = 0 
          AND v.elim = 0;
    `;

    const rows = await executeQuery({ db, query: sql, values: [idVariante] });

    if (!rows.length) {
        throw new Error("Error al obtener la variante creada.");
    }

    const variante = {
        did: rows[0].variante_did,
        codigo: rows[0].variante_codigo,
        nombre: rows[0].variante_nombre,
        descripcion: rows[0].variante_descripcion,
        habilitado: rows[0].variante_habilitado,
        orden: rows[0].variante_orden,
        categorias: [],
    };

    const categoriasMap = new Map();

    for (const r of rows) {
        if (!r.categoria_id) continue;

        if (!categoriasMap.has(r.categoria_did)) {
            categoriasMap.set(r.categoria_did, {
                did: r.categoria_did,
                nombre: r.categoria_nombre,
                valores: [],
            });
        }

        const cat = categoriasMap.get(r.categoria_did);

        if (r.valor_id) {
            cat.valores.push({
                did: r.valor_did,
                codigo: r.valor_codigo,
                nombre: r.valor_nombre,
            });
        }
    }

    variante.categorias = Array.from(categoriasMap.values());

    return {
        success: true,
        message: "Variante creada correctamente",
        data: variante,
        meta: { timestamp: new Date().toISOString() },
    };
}
