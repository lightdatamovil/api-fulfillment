import { executeQuery } from "lightdata-tools";

export async function preloader(dbConnection) {
    // --- Productos
    const queryProductos = `
        SELECT p.did AS did, p.did_cliente, p.titulo, p.habilitado, p.es_combo, p.cm3
        FROM productos AS p
        WHERE p.elim = 0 AND p.superado = 0
        ORDER BY p.did DESC
    `;
    const productos = await executeQuery(dbConnection, queryProductos);

    // --- Curvas (reemplazo de variantes)
    const queryCurvas = `
        SELECT 
            vc.did AS curva_id,
            vc.nombre AS curva_nombre,
            vc.id AS curva_pk,
            
            vcc.did_categoria,
            cat.nombre AS categoria_nombre,
            cat.codigo AS categoria_codigo,
            
            sub.id AS subcategoria_id,
            sub.nombre AS subcategoria_nombre,
            
            val.id AS valor_id,
            val.nombre AS valor_nombre

        FROM variantes_curvas vc
        LEFT JOIN variantes_categorias_curvas vcc 
            ON vc.id = vcc.did_curva 
            AND vcc.elim = 0 AND vcc.superado = 0
        LEFT JOIN variantes_categorias cat 
            ON cat.id = vcc.did_categoria 
            AND cat.elim = 0 AND cat.superado = 0
        LEFT JOIN variantes_subcategorias sub 
            ON sub.did_categoria = cat.id 
            AND sub.elim = 0 AND sub.superado = 0
        LEFT JOIN variantes_subcategoria_valores val 
            ON val.did_subcategoria = sub.id 
            AND val.elim = 0 AND val.superado = 0
        WHERE vc.elim = 0 AND vc.superado = 0
        ORDER BY vc.did DESC, cat.id DESC, sub.id DESC, val.id DESC
    `;
    const rowsCurvas = await executeQuery(dbConnection, queryCurvas, []);

    // Mapear curvas → categorías → subcategorías → valores
    const curvasMap = new Map();

    for (const row of rowsCurvas) {
        if (!curvasMap.has(row.curva_id)) {
            curvasMap.set(row.curva_id, {
                did: row.curva_id,
                nombre: row.curva_nombre,
                categorias: []
            });
        }

        const curva = curvasMap.get(row.curva_id);

        // Categorías
        if (row.did_categoria) {
            let categoria = curva.categorias.find(c => c.did === row.did_categoria);
            if (!categoria) {
                categoria = {
                    did: row.did_categoria,
                    nombre: row.categoria_nombre,
                    codigo: row.categoria_codigo,
                    subcategorias: []
                };
                curva.categorias.push(categoria);
            }

            // Subcategorías
            if (row.subcategoria_id) {
                let subcat = categoria.subcategorias.find(s => s.id === row.subcategoria_id);
                if (!subcat) {
                    subcat = {
                        id: row.subcategoria_id,
                        nombre: row.subcategoria_nombre,
                        valores: []
                    };
                    categoria.subcategorias.push(subcat);
                }

                // Valores
                if (row.valor_id) {
                    subcat.valores.push({
                        id: row.valor_id,
                        nombre: row.valor_nombre
                    });
                }
            }
        }
    }

    const curvas = Array.from(curvasMap.values());

    // --- Insumos
    const queryInsumos = `
        SELECT * FROM insumos
        WHERE elim = 0 AND superado = 0
        ORDER BY did DESC
    `;
    const insumos = await executeQuery(dbConnection, queryInsumos, []);

    // --- Clientes y cuentas
    const queryClientes = `
        SELECT 
            c.did AS cliente_did,
            c.codigo, 
            c.nombre_fantasia, 
            c.habilitado,
            cc.did AS cuenta_did, 
            cc.flex,
            cc.titulo
        FROM clientes c
        LEFT JOIN clientes_cuentas cc 
            ON c.did = cc.did_cliente 
            AND cc.elim = 0 AND cc.superado = 0
        WHERE c.elim = 0 AND c.superado = 0
        ORDER BY c.did DESC
    `;
    const rowsClientes = await executeQuery(dbConnection, queryClientes, []);

    const clientesMap = new Map();

    for (const row of rowsClientes) {
        if (!clientesMap.has(row.cliente_did)) {
            clientesMap.set(row.cliente_did, {
                did: row.cliente_did,
                codigo: row.codigo,
                nombre_fantasia: row.nombre_fantasia,
                habilitado: row.habilitado,
                cuentas: []
            });
        }
        if (row.cuenta_did) {
            clientesMap.get(row.cliente_did).cuentas.push({
                did: row.cuenta_did,
                flex: row.flex,
                titulo: row.titulo || ""
            });
        }
    }

    const clientes = Array.from(clientesMap.values());

    return {
        success: true,
        message: "Datos pre-cargados correctamente",
        data: {
            productos,
            curvas,
            insumos,
            clientes
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}
