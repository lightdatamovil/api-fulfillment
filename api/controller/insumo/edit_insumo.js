import { isDefined, LightdataORM } from "lightdata-tools";

export async function editInsumo({ db, req }) {
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

    const [current] = await LightdataORM.select({
        db,
        table: "insumos",
        where: { did: didInsumo },
        throwIfNotExists: true,
    });

    if (isDefined(codigo) && String(codigo).trim() !== "") {
        const posibles = await LightdataORM.select({
            db,
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

    await LightdataORM.update({
        db,
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

    const toAdd = toNumberSet(clientes_dids?.add);
    const toRemove = toNumberSet(clientes_dids?.remove);

    if (toRemove.length > 0) {
        await LightdataORM.delete({
            db,
            table: "insumos_clientes",
            where: { did_insumo: didInsumo, did_cliente: toRemove },
            quien: userId,
        });
    }

    if (toAdd.length > 0) {
        await LightdataORM.select({
            db,
            table: "insumos_clientes",
            where: { did_insumo: didInsumo, did_cliente: toAdd },
            throwIfExists: true,
        });

        const data = toAdd.map((did_cliente) => ({ did_insumo: didInsumo, did_cliente }));

        await LightdataORM.insert({
            db,
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
