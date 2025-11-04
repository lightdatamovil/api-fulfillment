import { executeQuery, LightdataORM } from "lightdata-tools";

export async function preloader({ db }) {
  const q = `
    SELECT 
      p.*, 
      pvv.did AS did_productos_variantes_valores,
      pvv.valores AS valores_raw
    FROM productos AS p
    LEFT JOIN productos_variantes_valores AS pvv
      ON p.did = pvv.did_producto
    WHERE p.elim = 0
      AND p.superado = 0
    ORDER BY p.did DESC;
  `;
  const rows = await executeQuery({ db, query: q });

  const productos = Object.values(rows.reduce((acc, row) => {
    if (!acc[row.did]) {
      acc[row.did] = { ...row, valores: [] };
    }
    if (row.did_productos_variantes_valores) {
      acc[row.did].valores.push({
        did_productos_variantes_valores: row.did_productos_variantes_valores,
        valores: row.valores_raw
          ? row.valores_raw.split(",").map(v => Number(v.trim()))
          : []
      });
    }
    delete acc[row.did].did_productos_variantes_valores;
    delete acc[row.did].valores_raw;
    return acc;
  }, {}));

  const queryVariantes = `
    SELECT
      v.did          AS variante_did,
      v.codigo       AS variante_codigo,
      v.nombre       AS variante_nombre,
      v.descripcion  AS variante_descripcion,
      v.habilitado   AS variante_habilitado,
      v.orden        AS variante_orden,

      vc.did         AS categoria_did,
      vc.nombre      AS categoria_nombre,

      vcv.did        AS valor_did,
      vcv.codigo     AS valor_codigo,
      vcv.nombre     AS valor_nombre

    FROM variantes v
    LEFT JOIN variantes_categorias vc
      ON vc.did_variante = v.did
     AND vc.elim = 0 AND vc.superado = 0
    LEFT JOIN variantes_categoria_valores vcv
      ON vcv.did_categoria = vc.did
     AND vcv.elim = 0 AND vcv.superado = 0
    WHERE v.elim = 0 AND v.superado = 0
    ORDER BY v.did DESC, vc.did DESC, vcv.did DESC
  `;
  const rowsVariantes = await executeQuery({ db, query: queryVariantes });

  const variantesMap = new Map();

  for (const r of rowsVariantes) {
    if (!variantesMap.has(r.variante_did)) {
      variantesMap.set(r.variante_did, {
        did: r.variante_did,
        codigo: r.variante_codigo,
        nombre: r.variante_nombre,
        descripcion: r.variante_descripcion,
        habilitado: r.variante_habilitado,
        orden: r.variante_orden,
        categorias: [],
      });
    }
    const variante = variantesMap.get(r.variante_did);

    if (r.categoria_did) {
      let cat = variante.categorias.find((c) => c.did === r.categoria_did);
      if (!cat) {
        cat = { did: r.categoria_did, nombre: r.categoria_nombre, valores: [] };
        variante.categorias.push(cat);
      }
      if (r.valor_did) {
        cat.valores.push({
          did: r.valor_did,
          codigo: r.valor_codigo,
          nombre: r.valor_nombre
        });
      }
    }
  }
  const variantes = Array.from(variantesMap.values());

  const queryCurvas = `
    SELECT
      cu.did     AS curva_did,
      cu.nombre  AS curva_nombre,
      cu.codigo  AS curva_codigo,

      vc.did     AS categoria_did,
      vc.did_variante AS variante_did,
      vc.nombre  AS categoria_nombre,

      vcv.did    AS valor_did,
      vcv.nombre AS valor_nombre

    FROM curvas cu
    LEFT JOIN variantes_curvas vcu
      ON vcu.did_curva = cu.did
     AND vcu.elim = 0 AND vcu.superado = 0
    LEFT JOIN variantes_categorias vc
      ON vc.did = vcu.did_categoria
     AND vc.elim = 0 AND vc.superado = 0
    LEFT JOIN variantes_categoria_valores vcv
      ON vcv.did_categoria = vc.did
     AND vcv.elim = 0 AND vcv.superado = 0
    WHERE cu.elim = 0 AND cu.superado = 0
    ORDER BY cu.did DESC, vc.did DESC, vcv.did DESC
  `;
  const rowsCurvas = await executeQuery({ db, query: queryCurvas });

  const curvasMap = new Map();

  for (const r of rowsCurvas) {
    if (!curvasMap.has(r.curva_did)) {
      curvasMap.set(r.curva_did, {
        did: r.curva_did,
        nombre: r.curva_nombre,
        codigo: r.curva_codigo,
        categorias: [],
      });
    }
    const curva = curvasMap.get(r.curva_did);

    if (r.categoria_did) {
      let cat = curva.categorias.find((c) => c.did === r.categoria_did);
      if (!cat) {
        cat = { did: r.categoria_did, nombre: r.categoria_nombre, did_variante: r.variante_did, valores: [] };
        curva.categorias.push(cat);
      }
      if (r.valor_did) {
        cat.valores.push({ did: r.valor_did, nombre: r.valor_nombre });
      }
    }
  }

  const curvas = Array.from(curvasMap.values());
  const selectUsuario = await LightdataORM.select({
    db,
    table: "usuarios",
  });

  const usuarios = selectUsuario.map((u) => ({
    did: u.did,
    nombre: u.nombre,
    apellido: u.apellido,
    habilitado: u.habilitado,
    perfil: u.perfil,
    telefono: u.telefono,
    usuario: u.usuario,
    codigo_cliente: u.codigo_cliente,
    app_habilitada: u.app_habilitada,
    accesos: u.accesos,


    email: u.email,
  }));


  const insumos = await LightdataORM.select({
    db,
    table: "insumos",
  });

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

  const rowsClientes = await executeQuery({ db, query: queryClientes });

  const clientesMap = new Map();

  for (const row of rowsClientes) {
    if (!clientesMap.has(row.cliente_did)) {
      clientesMap.set(row.cliente_did, {
        did: row.cliente_did,
        codigo: row.codigo,
        nombre_fantasia: row.nombre_fantasia,
        habilitado: row.habilitado,
        cuentas: [],
      });
    }
    if (row.cuenta_did) {
      clientesMap.get(row.cliente_did).cuentas.push({
        did: row.cuenta_did,
        flex: row.flex,
        titulo: row.titulo || "",
      });
    }
  }

  const clientes = Array.from(clientesMap.values());

  return {
    success: true,
    message: "Datos pre-cargados correctamente",
    data: { productos, variantes, curvas, insumos, clientes, usuarios },
    meta: { timestamp: new Date().toISOString() },
  };
}
