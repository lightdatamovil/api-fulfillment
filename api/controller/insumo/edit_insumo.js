import { executeQuery, isNonEmpty, isDefined, LightdataQuerys, CustomException } from "lightdata-tools";
import { DbUtils } from "../../src/functions/db_utils.js";

export async function editInsumo(dbConnection, req) {
    const { userId } = req.user;
    const { insumoId } = req.params;
    const { codigo, nombre, unidad, habilitado, clientes_dids_add, clientes_dids_remove } = req.body;

    const norm = (v) => new Set(v.map(n => Number(n)));

    const current = await DbUtils.verifyExistsAndSelect({
        dbConnection,
        table: "insumos",
        column: "did",
        valor: insumoId,
        select: "*"
    });

    if (isNonEmpty(codigo)) {
        const exists = await DbUtils.existsInDb(dbConnection, "insumos", "codigo", codigo);
        if (exists) {
            throw new CustomException({
                title: "Código duplicado",
                message: `El código ${codigo} ya existe en otro insumo.`,
            });
        }
    }

    const newCodigo = isDefined(codigo) ? codigo : current.codigo;
    const newNombre = isDefined(nombre) ? nombre : current.nombre;
    const newUnidad = isDefined(unidad) ? unidad : current.unidad;
    const newHabilitado = isDefined(habilitado) ? habilitado : current.habilitado;

    await LightdataQuerys.update({
        dbConnection,
        tabla: "insumos",
        did: insumoId,
        quien: userId,
        data: {
            codigo: newCodigo,
            nombre: newNombre,
            unidad: newUnidad,
            habilitado: newHabilitado
        }
    });

    const toAdd = norm(clientes_dids_add);
    const toRemove = norm(clientes_dids_remove);

    if (toRemove.length > 0) {
        await LightdataQuerys.delete({
            dbConnection,
            tabla: "insumos_clientes",
            did: toRemove,
            quien: userId,
        });
    }

    if (toAdd.length > 0) {
        const data = toAdd.map(clienteId => ({
            did_insumo: insumoId,
            did_cliente: clienteId,
        }));

        await LightdataQuerys.insert({
            dbConnection,
            tabla: "insumos_clientes",
            quien: userId,
            data
        });
    }

    const activos = await executeQuery(
        dbConnection,
        `SELECT did_cliente
     FROM insumos_clientes
     WHERE did_insumo = ? AND superado = 0 AND elim = 0
     ORDER BY did_cliente ASC`,
        [insumoId]
    );

    return {
        success: true,
        message: "Insumo actualizado correctamente",
        data: {
            did: Number(insumoId),
            clientes_ids: activos.map(r => r.did_cliente),
        },
        meta: { timestamp: new Date().toISOString() },
    };
}
