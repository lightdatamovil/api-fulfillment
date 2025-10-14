import { isNonEmpty, isDefined, number01, LightdataORM, CustomException, Status } from "lightdata-tools";

/**
 * PUT /api/variantes/:varianteId
 * Versión optimizada con operaciones batch, ahora soporta:
 * - categorias.add: permite incluir "valores" para insertar junto con la categoría
 * - categorias.update: permite "valores" con { add[], update[], remove[] }
 * - categorias.remove: borra primero valores asociados y luego la categoría
 */
export async function editVariante(dbConnection, req) {
    const { varianteId } = req.params;
    const userId = Number(req.user.userId);
    const body = req.body;

    const arr = (x) => (Array.isArray(x) ? x : []);
    const normRemove = (list) =>
        arr(list)
            .map((x) => (typeof x === "object" ? Number(x?.did ?? 0) : Number(x)))
            .filter((n) => Number.isFinite(n) && n > 0);

    // ---- Nuevo body: categorías anidadas (y valores dentro de add/update) ----
    const cAdd = arr(body?.categorias?.add);
    const cUpd = arr(body?.categorias?.update);
    const cDel = normRemove(body?.categorias?.remove);

    // -------------------------------------------------------------------------
    // Datos de la variante
    // -------------------------------------------------------------------------
    const [vigente] = await LightdataORM.select({
        dbConnection,
        table: "variantes",
        where: { did: varianteId },
        throwIfNotExists: true,
    });

    const nextCodigo = isNonEmpty(body.codigo) ? String(body.codigo).trim() : vigente.codigo;

    if (nextCodigo !== vigente.codigo) {
        // si existe otra variante con ese código, fallar
        const dup = await LightdataORM.select({
            dbConnection,
            table: "variantes",
            where: { codigo: nextCodigo },
            throwIfNotExists: false,
            limit: 1,
        });
        if (Array.isArray(dup) && dup.length > 0) {
            const otro = dup[0];
            if (Number(otro?.did) !== Number(varianteId)) {
                throw new CustomException({
                    title: "Código duplicado",
                    message: `Ya existe una variante con código '${nextCodigo}'`,
                    status: Status.conflict,
                });
            }
        }
    }

    const nextNombre = isNonEmpty(body.nombre)
        ? String(body.nombre).trim()
        : vigente.nombre;
    const nextDesc = isDefined(body.descripcion)
        ? isNonEmpty(body.descripcion)
            ? String(body.descripcion).trim()
            : null
        : vigente.descripcion;

    let nextHab = vigente.habilitado;
    if (isDefined(body.habilitado)) {
        const h = number01(body.habilitado);
        if (h !== 0 && h !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "habilitado debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        nextHab = h;
    }
    const nextOrden = Number.isFinite(Number(body.orden))
        ? Number(body.orden)
        : (vigente.orden ?? 0);

    await LightdataORM.update({
        dbConnection,
        table: "variantes",
        where: { did: varianteId },
        quien: userId,
        data: {
            codigo: nextCodigo,
            nombre: nextNombre,
            descripcion: nextDesc,
            habilitado: nextHab,
            orden: nextOrden,
        },
    });

    // -------------------------------------------------------------------------
    // Categorías: add / update / remove
    // -------------------------------------------------------------------------

    // ADD: inserta categorías y, si vienen valores, también los inserta
    const batchInsertsCategorias = cAdd
        .filter((c) => isNonEmpty(c?.nombre))
        .map((c) => ({
            did_variante: Number(varianteId),
            nombre: String(c.nombre).trim(),
        }));

    /** mapa auxiliar para ubicar el did de las categorías recién creadas por nombre */
    let mapCatNombreToDid = {};

    if (batchInsertsCategorias.length > 0) {
        await LightdataORM.insert({
            dbConnection,
            table: "variantes_categorias",
            data: batchInsertsCategorias,
            quien: userId,
        });

        // recuperar dids por nombre (asumimos nombres únicos dentro de la variante)
        const nombres = batchInsertsCategorias.map((r) => r.nombre);
        const creadas = await LightdataORM.select({
            dbConnection,
            table: "variantes_categorias",
            where: { did_variante: Number(varianteId), nombre: nombres },
            throwIfNotExists: false,
        });
        mapCatNombreToDid = {};
        arr(creadas).forEach((r) => {
            if (r?.nombre && Number(r?.did) > 0) {
                mapCatNombreToDid[String(r.nombre)] = Number(r.did);
            }
        });

        // insertar valores de las categorías nuevas (si vinieron)
        const valoresNuevos = [];
        for (const c of cAdd) {
            const nombre = String(c?.nombre ?? "");
            const didCat = mapCatNombreToDid[nombre];
            if (Number.isFinite(didCat) && didCat > 0 && Array.isArray(c?.valores) && c.valores.length) {
                for (const v of c.valores) {
                    if (!isNonEmpty(v?.nombre)) continue;
                    valoresNuevos.push({
                        did_categoria: didCat,
                        codigo: isNonEmpty(v?.codigo) ? String(v.codigo).trim() : null,
                        nombre: String(v.nombre).trim(),
                    });
                }
            }
        }
        if (valoresNuevos.length > 0) {
            await LightdataORM.insert({
                dbConnection,
                table: "variantes_categoria_valores",
                data: valoresNuevos,
                quien: userId,
            });
        }
    }

    // UPDATE (categorías): solo nombre
    if (cUpd.length > 0) {
        const dids = cUpd.map((c) => Number(c.did)).filter((n) => Number.isFinite(n) && n > 0);
        const datas = cUpd.map((c) => ({
            nombre: isNonEmpty(c?.nombre) ? String(c.nombre).trim() : null,
        }));

        if (dids.length > 0) {
            await LightdataORM.update({
                dbConnection,
                table: "variantes_categorias",
                where: { did: dids },
                data: datas,
                quien: userId,
            });
        }
    }

    // UPDATE (valores dentro de cada categoría en update): { add, update, remove }
    for (const c of cUpd) {
        const didCat = Number(c?.did);
        if (!Number.isFinite(didCat) || didCat <= 0) continue;

        const vAdd = arr(c?.valores?.add);
        const vUpd = arr(c?.valores?.update);
        const vDel = normRemove(c?.valores?.remove);

        // add
        if (vAdd.length > 0) {
            const rows = vAdd
                .filter((v) => isNonEmpty(v?.nombre))
                .map((v) => ({
                    did_categoria: didCat,
                    codigo: isNonEmpty(v?.codigo) ? String(v.codigo).trim() : null,
                    nombre: String(v.nombre).trim(),
                }));
            if (rows.length > 0) {
                await LightdataORM.insert({
                    dbConnection,
                    table: "variantes_categoria_valores",
                    data: rows,
                    quien: userId,
                });
            }
        }

        // update
        if (vUpd.length > 0) {
            const dids = vUpd.map((v) => Number(v?.did)).filter((n) => Number.isFinite(n) && n > 0);
            const datas = vUpd.map((v) => ({
                codigo: isNonEmpty(v?.codigo) ? String(v.codigo).trim() : null,
                nombre: isNonEmpty(v?.nombre) ? String(v.nombre).trim() : null,
            }));
            if (dids.length > 0) {
                await LightdataORM.update({
                    dbConnection,
                    table: "variantes_categoria_valores",
                    where: { did: dids },
                    data: datas,
                    quien: userId,
                });
            }
        }

        // remove
        if (vDel.length > 0) {
            await LightdataORM.delete({
                dbConnection,
                table: "variantes_categoria_valores",
                where: { did: vDel },
                quien: userId,
            });
        }
    }

    // REMOVE (categorías): borrar primero valores, luego categorías
    if (cDel.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_categoria_valores",
            where: { did_categoria: cDel },
            quien: userId,
        });
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_categorias",
            where: { did: cDel },
            quien: userId,
        });
    }

    return {
        success: true,
        message: "Variante actualizada correctamente (anidado)",
        data: { did: Number(varianteId) },
        meta: { timestamp: new Date().toISOString() },
    };
}
