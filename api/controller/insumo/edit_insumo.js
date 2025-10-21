import { isDefined, LightdataORM } from "lightdata-tools";

export async function editInsumo(dbConnection, req) {
    const { userId } = req.user;
    const { insumoId } = req.params;
    const { codigo, nombre, unidad, habilitado, clientes_dids } = req.body ?? {};

    const didInsumo = Number(insumoId);
    if (!Number.isFinite(didInsumo)) {
        throw new Error("insumoId inválido");
    }

    const toNumberSet = (v) => {
        if (!Array.isArray(v)) return [];
        const nums = v.map((n) => Number(n)).filter(Number.isFinite);
        return Array.from(new Set(nums));
    };

    // 1) Obtener el registro actual (y validar existencia)
    const [current] = await LightdataORM.select({
        dbConnection,
        table: "insumos",
        where: { did: didInsumo },
        throwIfNotExists: true,
    });

    // 2) Validar unicidad de "codigo" (si vino algo)
    if (isDefined(codigo) && String(codigo).trim() !== "") {
        const posibles = await LightdataORM.select({
            dbConnection,
            table: "insumos",
            where: { elim: 0, codigo },
        });
        const colision = posibles?.find((r) => Number(r?.did) !== didInsumo);
        if (colision) {
            const err = new Error("El código ya está en uso por otro insumo");
            err.code = "CODIGO_DUPLICADO";
            throw err;
        }
    }

    const newCodigo = isDefined(codigo) ? codigo : current.codigo;
    const newNombre = isDefined(nombre) ? nombre : current.nombre;
    const newUnidad = isDefined(unidad) ? unidad : current.unidad;
    const newHabilitado = isDefined(habilitado) ? habilitado : current.habilitado;

    // 3) Actualizar insumo
    await LightdataORM.update({
        dbConnection,
        table: "insumos",
        where: { did: didInsumo },
        quien: userId,
        data: {
            codigo: newCodigo,
            nombre: newNombre,
            unidad: newUnidad,
            habilitado: newHabilitado,
        },
    });

    // 4) Sincronizar relación insumo <-> clientes
    const toAdd = toNumberSet(clientes_dids?.add);
    const toRemove = toNumberSet(clientes_dids?.remove);

    // 4a) Remover vínculos por (did_insumo, did_cliente)
    if (toRemove.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "insumos_clientes",
            where: { did_insumo: didInsumo, did_cliente: toRemove },
            quien: userId,
        });
    }

    // 4b) Agregar vínculos nuevos, evitando duplicados
    if (toAdd.length > 0) {
        await LightdataORM.select({
            dbConnection,
            table: "insumos_clientes",
            where: { did_insumo: didInsumo, did_cliente: toAdd },
            throwIfExists: true,
        });

        const data = toAdd.map((did_cliente) => ({ did_insumo: didInsumo, did_cliente }));

        await LightdataORM.insert({
            dbConnection,
            table: "insumos_clientes",
            quien: userId,
            data,
        });
    }

    return {
        success: true,
        message: "Insumo actualizado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}

/*
Notas clave (JS):
- Sin tipos TS.
- Se normaliza y valida insumoId como número.
- Valida unicidad de 'codigo' excluyendo el propio insumo.
- Delete en tabla puente por (did_insumo, did_cliente) en lugar de 'did'.
- Dedup y filtrado de NaN en add/remove.
- Si tu ORM no soporta arrays en 'where', reemplazar por IN o loop.
*/
