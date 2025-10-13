import { isNonEmpty, isDefined, number01, LightdataORM, CustomException, Status } from "lightdata-tools";

/**
 * PUT /api/variantes/:varianteId
 * Versión optimizada con operaciones batch, aprovechando el nuevo update.
 */
export async function editVariante(dbConnection, req) {
    const { varianteId } = req.params;
    const userId = Number(req?.user?.userId ?? req?.user?.id ?? 0) || null;
    const body = req.body || {};

    const arr = (x) => (Array.isArray(x) ? x : []);
    const normRemove = (list) =>
        arr(list)
            .map((x) => (typeof x === "object" ? Number(x?.did ?? 0) : Number(x)))
            .filter((n) => Number.isFinite(n) && n > 0);

    const cAdd = arr(body?.categorias?.add);
    const cUpd = arr(body?.categorias?.update);
    const cDel = normRemove(body?.categorias?.remove);

    const vAdd = arr(body?.valores?.add);
    const vUpd = arr(body?.valores?.update);
    const vDel = normRemove(body?.valores?.remove);

    const changed = {
        variante: 0,
        categorias: { added: 0, updated: 0, removed: 0 },
        valores: { added: 0, updated: 0, removed: 0 },
    };

    const vigenteRows = await LightdataORM.select({
        dbConnection,
        table: "variantes",
        column: "did",
        value: varianteId,
        throwExceptionIfNotExists: true,
    });
    const vigente = vigenteRows[0];

    const baseFields = ["codigo", "nombre", "descripcion", "habilitado", "orden"];
    const hayPatch = baseFields.some((k) => body[k] !== undefined);

    if (hayPatch) {
        const nextCodigo = isNonEmpty(body.codigo) ? String(body.codigo).trim() : vigente.codigo;

        if (nextCodigo !== vigente.codigo) {
            await LightdataORM.select({
                dbConnection,
                table: "variantes",
                columns: ["codigo"],
                values: [nextCodigo],
                throwExceptionIfAlreadyExists: true,
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
            did: Number(varianteId),
            quien: userId,
            data: {
                codigo: nextCodigo,
                nombre: nextNombre,
                descripcion: nextDesc,
                habilitado: nextHab,
                orden: nextOrden,
            },
        });

        changed.variante = 1;
    }

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
        changed.categorias.added = batchInsertsCategorias.length;
    }

    if (cUpd.length > 0) {
        const dids = cUpd.map((c) => Number(c.did)).filter(Boolean);
        const datas = cUpd.map((c) => ({
            nombre: isNonEmpty(c?.nombre) ? String(c.nombre).trim() : null,
        }));

        await LightdataORM.update({
            dbConnection,
            table: "variantes_categorias",
            did: dids.length === 1 ? dids[0] : dids,
            data: datas.length === 1 ? datas[0] : datas,
            quien: userId,
        });

        changed.categorias.updated = cUpd.length;
    }

    if (cDel.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_categorias",
            did: cDel,
            quien: userId,
        });
        changed.categorias.removed = cDel.length;
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
        changed.valores.added = batchInsertValores.length;
    }

    if (vUpd.length > 0) {
        const dids = vUpd.map((v) => Number(v.did)).filter(Boolean);
        const datas = vUpd.map((v) => ({
            nombre: isNonEmpty(v?.nombre) ? String(v.nombre).trim() : null,
        }));

        await LightdataORM.update({
            dbConnection,
            table: "variantes_categoria_valores",
            did: dids.length === 1 ? dids[0] : dids,
            data: datas.length === 1 ? datas[0] : datas,
            quien: userId,
        });

        changed.valores.updated = vUpd.length;
    }

    if (vDel.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "variantes_categoria_valores",
            did: vDel,
            quien: userId,
        });
        changed.valores.removed = vDel.length;
    }

    return {
        success: true,
        message: "Variante actualizada correctamente (versionado)",
        data: { did: Number(varianteId) },
        meta: { changed, timestamp: new Date().toISOString() },
    };
}
