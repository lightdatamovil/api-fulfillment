import { isNonEmpty, isDefined, number01, LightdataORM, CustomException, Status } from "lightdata-tools";

/**
 * PUT /api/variantes/:varianteId
 * Versión optimizada con operaciones batch, aprovechando el nuevo update.
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

    const cAdd = arr(body.categorias.add);
    const cUpd = arr(body.categorias.update);
    const cDel = normRemove(body.categorias.remove);

    const vAdd = arr(body.valores.add);
    const vUpd = arr(body.valores.update);
    const vDel = normRemove(body.valores.remove);

    const [vigente] = await LightdataORM.select({
        dbConnection,
        table: "variantes",
        where: { did: varianteId },
        throwIfNotExists: true,
    });

    const nextCodigo = isNonEmpty(body.codigo) ? String(body.codigo).trim() : vigente.codigo;

    if (nextCodigo !== vigente.codigo) {
        await LightdataORM.select({
            dbConnection,
            table: "variantes",
            where: { codigo: nextCodigo },
            throwIfNotExists: true,
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

    const batchInsertsCategorias = cAdd
        .filter((c) => isNonEmpty(c?.nombre))
        .map((c) => ({
            did_variante: Number(varianteId),
            nombre: String(c.nombre).trim(),
        }));

    if (batchInsertsCategorias.length > 0) {
        await LightdataORM.insert({
            dbConnection,
            table: "variantes_categorias",
            data: batchInsertsCategorias,
            quien: userId,
        });
    }

    if (cUpd.length > 0) {
        const dids = cUpd.map((c) => Number(c.did)).filter(Boolean);
        const datas = cUpd.map((c) => ({
            nombre: isNonEmpty(c?.nombre) ? String(c.nombre).trim() : null,
        }));

        await LightdataORM.update({
            dbConnection,
            table: "variantes_categorias",
            where: { did: dids },
            data: datas,
            quien: userId,
        });
    }

    if (cDel.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_categorias",
            where: { did: cDel },
            quien: userId,
        });
    }

    const batchInsertValores = vAdd
        .filter((v) => isNonEmpty(v?.nombre) && Number(v?.did_categoria) > 0)
        .map((v) => ({
            did_categoria: Number(v.did_categoria),
            nombre: String(v.nombre).trim(),
        }));

    if (batchInsertValores.length > 0) {
        await LightdataORM.insert({
            dbConnection,
            table: "variantes_categoria_valores",
            data: batchInsertValores,
            quien: userId,
        });
    }

    if (vUpd.length > 0) {
        const dids = vUpd.map((v) => Number(v.did)).filter(Boolean);
        const datas = vUpd.map((v) => ({
            nombre: isNonEmpty(v?.nombre) ? String(v.nombre).trim() : null,
        }));

        await LightdataORM.update({
            dbConnection,
            table: "variantes_categoria_valores",
            where: { did: dids },
            data: datas,
            quien: userId,
        });
    }

    if (vDel.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_categoria_valores",
            where: { did: vDel },
            quien: userId,
        });
    }

    return {
        success: true,
        message: "Variante actualizada correctamente (versionado)",
        data: { did: Number(varianteId) },
        meta: { timestamp: new Date().toISOString() },
    };
}
