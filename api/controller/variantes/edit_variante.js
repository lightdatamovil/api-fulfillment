import { isNonEmpty, isDefined, number01, LightdataORM, CustomException, Status } from "lightdata-tools";

/**
 * PUT /api/variantes/:varianteId
 * Versión optimizada con operaciones batch, ahora soporta:
 * - categorias.add: permite incluir "valores" para insertar junto con la categoría
 * - categorias.update: permite "valores" con { add[], update[], remove[] }
 * - categorias.remove: borra primero valores asociados y luego la categoría
 */
export async function editVariante(db, req) {
    const { varianteId } = req.params;
    const userId = Number(req.user.userId);
    const body = req.body;

    const arr = (x) => (Array.isArray(x) ? x : []);
    const normRemove = (list) =>
        arr(list)
            .map((x) => (typeof x === "object" ? Number(x?.did ?? 0) : Number(x)))
            .filter((n) => Number.isFinite(n) && n > 0);

    const cAdd = arr(body?.categorias?.add);
    const cUpd = arr(body?.categorias?.update);
    const cDel = normRemove(body?.categorias?.remove);

    const [vigente] = await LightdataORM.select({
        db,
        table: "variantes",
        where: { did: varianteId },
        throwIfNotExists: true,
    });

    const nextCodigo = isNonEmpty(body.codigo) ? String(body.codigo).trim() : vigente.codigo;

    if (nextCodigo !== vigente.codigo) {
        await LightdataORM.select({
            db,
            table: "variantes",
            where: { codigo: nextCodigo },
            throwIfExists: true,
        });
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
        db,
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

    const batchInsertsCategorias = cAdd
        .filter((c) => isNonEmpty(c?.nombre))
        .map((c) => ({
            did_variante: Number(varianteId),
            nombre: String(c.nombre).trim(),
        }));

    let mapCatNombreToDid = {};

    if (batchInsertsCategorias.length > 0) {
        await LightdataORM.insert({
            db,
            table: "variantes_categorias",
            data: batchInsertsCategorias,
            quien: userId,
        });

        // recuperar dids por nombre (asumimos nombres únicos dentro de la variante)
        const nombres = batchInsertsCategorias.map((r) => r.nombre);
        const creadas = await LightdataORM.select({
            db,
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
                db,
                table: "variantes_categoria_valores",
                data: valoresNuevos,
                quien: userId,
            });
        }
    }

    if (cUpd.length > 0) {
        const dids = cUpd.map((c) => Number(c.did)).filter((n) => Number.isFinite(n) && n > 0);
        const datas = cUpd.map((c) => ({
            nombre: isNonEmpty(c?.nombre) ? String(c.nombre).trim() : null,
        }));

        if (dids.length > 0) {
            await LightdataORM.update({
                db,
                table: "variantes_categorias",
                where: { did: dids },
                data: datas,
                quien: userId,
            });
        }
    }

    for (const c of cUpd) {
        const didCat = Number(c?.did);
        if (!Number.isFinite(didCat) || didCat <= 0) continue;

        const vAdd = arr(c?.valores?.add);
        const vUpd = arr(c?.valores?.update);
        const vDel = normRemove(c?.valores?.remove);

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
                    db,
                    table: "variantes_categoria_valores",
                    data: rows,
                    quien: userId,
                });
            }
        }

        if (vUpd.length > 0) {
            const dids = vUpd.map((v) => Number(v?.did)).filter((n) => Number.isFinite(n) && n > 0);
            const datas = vUpd.map((v) => ({
                codigo: isNonEmpty(v?.codigo) ? String(v.codigo).trim() : null,
                nombre: isNonEmpty(v?.nombre) ? String(v.nombre).trim() : null,
            }));
            if (dids.length > 0) {
                await LightdataORM.update({
                    db,
                    table: "variantes_categoria_valores",
                    where: { did: dids },
                    data: datas,
                    quien: userId,
                });
            }
        }

        if (vDel.length > 0) {
            await LightdataORM.delete({
                db,
                table: "variantes_categoria_valores",
                where: { did: vDel },
                quien: userId,
            });
        }
    }

    if (cDel.length > 0) {
        await LightdataORM.delete({
            db,
            table: "variantes_categoria_valores",
            where: { did_categoria: cDel },
            quien: userId,
        });
        await LightdataORM.delete({
            db,
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
