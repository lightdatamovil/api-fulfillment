import { isNonEmpty, isDefined, LightdataORM } from "lightdata-tools";

export async function editInsumo(dbConnection, req) {
    const { userId } = req.user;
    const { insumoId } = req.params;
    const { codigo, nombre, unidad, habilitado, clientes_dids } = req.body;

    const norm = (v) => new Set(v.map(n => Number(n)));

    const [current] = await LightdataORM.select({
        dbConnection,
        table: "insumos",
        where: { did: insumoId },
        throwIfNotExists: true,
    });

    if (isNonEmpty(codigo)) {
        await LightdataORM.select({
            dbConnection,
            table: "insumos",
            column: "codigo",
            value: codigo,
            throwIfExists: true,
        });
    }

    const newCodigo = isDefined(codigo) ? codigo : current.codigo;
    const newNombre = isDefined(nombre) ? nombre : current.nombre;
    const newUnidad = isDefined(unidad) ? unidad : current.unidad;
    const newHabilitado = isDefined(habilitado) ? habilitado : current.habilitado;

    await LightdataORM.update({
        dbConnection,
        table: "insumos",
        where: { did: insumoId },
        quien: userId,
        data: {
            codigo: newCodigo,
            nombre: newNombre,
            unidad: newUnidad,
            habilitado: newHabilitado
        }
    });

    const toAdd = Array.from(norm(clientes_dids?.add || []));
    const toRemove = Array.from(norm(clientes_dids?.remove || []));

    if (toRemove.length > 0) {
        await LightdataORM.delete({
            dbConnection,
            table: "insumos_clientes",
            where: { did: toRemove },
            quien: userId,
        });
    }

    if (toAdd.length > 0) {
        await LightdataORM.select({
            dbConnection,
            table: "insumos_clientes",
            where: { did_insumo: insumoId, did_cliente: toAdd },
            throwIfExists: true,
        });
        const data = toAdd.map(clienteId => ({
            did_insumo: insumoId,
            did_cliente: clienteId,
        }));

        await LightdataORM.insert({
            dbConnection,
            table: "insumos_clientes",
            quien: userId,
            data
        });
    }

    return {
        success: true,
        message: "Insumo actualizado correctamente",
        data: {},
        meta: { timestamp: new Date().toISOString() },
    };
}
