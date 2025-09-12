import { CustomException, executeQuery, Status, isNonEmpty, isDefined, number01 } from "lightdata-tools";

/**
 * Edita un cliente (versionado por did) y procesa acciones sueltas en direcciones, contactos y cuentas.
 *
 * Param: req.params.clienteId  (did del cliente)
 *
 * Body:
 * {
 *   nombre_fantasia?, razon_social?, codigo?, habilitado?(0/1), observaciones?,
 *   direccionesData?: [
 *     { action: "create", data: { ...json... } },
 *     { action: "delete", did: number }                 // did de clientes_direcciones
 *   ],
 *   contactosData?: [
 *     { action: "create", tipo: number, valor: string },
 *     { action: "delete", did: number }                 // did de clientes_contactos
 *   ],
 *   cuentasData?: [
 *     { action: "create", tipo?: number, flex?: number, data?: object, depositos?: string, titulo?: string, ml_id_vendedor?: string, ml_user?: string },
 *     { action: "delete", did: number }                 // did de clientes_cuentas
 *   ]
 * }
 */
export async function editCliente(db, req) {
    const { clienteId } = req.params; // did del cliente
    const { userId } = req.user ?? {};

    const {
        nombre_fantasia,
        razon_social,
        codigo,
        habilitado,
        observaciones,

        direccionesData,
        contactosData,
        cuentasData,
    } = req.body ?? {};

    if (!isDefined(userId)) {
        throw new CustomException({
            title: "Sesión inválida",
            message: "No se pudo determinar el usuario (quien)",
            status: Status.unauthorized,
        });
    }

    // 1) Obtener cliente actual activo por did
    const qGet = `
    SELECT did, nombre_fantasia, razon_social, codigo, habilitado, observaciones
    FROM clientes
    WHERE did = ? AND elim = 0 AND superado = 0
    LIMIT 1
  `;
    const rows = await executeQuery(db, qGet, [clienteId]);
    if (!rows?.length) {
        throw new CustomException({
            title: "Cliente no encontrado",
            message: `No existe cliente activo con did=${clienteId}`,
            status: Status.notFound,
        });
    }
    const current = rows[0];

    // 2) Preparar nuevos valores (o conservar actuales)
    const newNF = isNonEmpty(nombre_fantasia) ? String(nombre_fantasia).trim() : current.nombre_fantasia;
    const newRS = isDefined(razon_social) ? (isNonEmpty(razon_social) ? String(razon_social).trim() : null) : current.razon_social;
    const newCOD = isDefined(codigo) ? (isNonEmpty(codigo) ? String(codigo).trim() : null) : current.codigo;

    let newHAB = current.habilitado;
    if (isDefined(habilitado)) {
        const h = number01(habilitado);
        if (h !== 0 && h !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "habilitado debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        newHAB = h;
    }

    const newOBS = isDefined(observaciones)
        ? (isNonEmpty(observaciones) ? String(observaciones).trim() : null)
        : current.observaciones;

    // 3) Validar duplicados si cambia nombre_fantasia o codigo
    if (newNF !== current.nombre_fantasia) {
        const dupNF = await executeQuery(
            db,
            `SELECT did FROM clientes WHERE nombre_fantasia = ? AND elim = 0 AND superado = 0 AND did <> ? LIMIT 1`,
            [newNF, clienteId]
        );
        if (dupNF?.length) {
            throw new CustomException({
                title: "Duplicado",
                message: `Ya existe un cliente activo con nombre_fantasia "${newNF}"`,
                status: Status.conflict,
            });
        }
    }
    if (newCOD !== current.codigo) {
        if (newCOD) {
            const dupCod = await executeQuery(
                db,
                `SELECT did FROM clientes WHERE codigo = ? AND elim = 0 AND superado = 0 AND did <> ? LIMIT 1`,
                [newCOD, clienteId]
            );
            if (dupCod?.length) {
                throw new CustomException({
                    title: "Duplicado",
                    message: `Ya existe un cliente activo con código "${newCOD}"`,
                    status: Status.conflict,
                });
            }
        }
    }

    // 4) Versionar cliente (superar actual + nueva versión con mismo did)
    await executeQuery(
        db,
        `UPDATE clientes SET superado = 1 WHERE did = ? AND elim = 0 AND superado = 0`,
        [clienteId]
    );

    const insCli = await executeQuery(
        db,
        `
      INSERT INTO clientes (did, nombre_fantasia, razon_social, codigo, habilitado, observaciones, quien, superado, elim, autofecha)
      VALUES (?,  ?,                ?,            ?,      ?,          ?,             ?,     0,        0,    NOW())
    `,
        [clienteId, newNF, newRS, newCOD, newHAB, newOBS, userId],
        true
    );

    if (!insCli?.affectedRows) {
        throw new CustomException({
            title: "Error al versionar cliente",
            message: "No se pudo crear la nueva versión del cliente",
            status: Status.internalServerError,
        });
    }

    // 5) Acciones sueltas: direcciones
    const dirCreated = [];
    const dirDeleted = [];
    if (Array.isArray(direccionesData)) {
        for (const item of direccionesData) {
            const action = String(item?.action || "").toLowerCase();

            if (action === "create") {
                const dataStr = JSON.stringify(item ?? {});
                const ins = await executeQuery(
                    db,
                    `
            INSERT INTO clientes_direcciones (didCliente, data, quien, superado, elim, autofecha)
            VALUES (?, ?, ?, 0, 0, NOW())
          `,
                    [Number(clienteId), dataStr, userId],
                    true
                );
                const id = ins.insertId;
                await executeQuery(db, `UPDATE clientes_direcciones SET did = ? WHERE id = ?`, [id, id], true);
                dirCreated.push({ id, did: id, didCliente: Number(clienteId), data: JSON.parse(dataStr || "{}") });
            }
            else if (action === "delete") {
                const didVal = Number(item?.did);
                if (!Number.isFinite(didVal) || didVal <= 0) {
                    throw new CustomException({
                        title: "Dato inválido",
                        message: "did inválido en direccionesData.delete",
                        status: Status.badRequest,
                    });
                }
                const del = await executeQuery(
                    db,
                    `UPDATE clientes_direcciones SET elim = 1 WHERE did = ? AND elim = 0`,
                    [didVal],
                    true
                );
                dirDeleted.push({ did: didVal, affectedRows: del?.affectedRows ?? 0 });
            }
            else {
                throw new CustomException({
                    title: "Acción inválida",
                    message: `direccionesData.action debe ser "create" o "delete"`,
                    status: Status.badRequest,
                });
            }
        }
    }

    // 6) Acciones sueltas: contactos
    const contCreated = [];
    const contDeleted = [];
    if (Array.isArray(contactosData)) {
        for (const item of contactosData) {
            const action = String(item?.action || "").toLowerCase();

            if (action === "create") {
                const tipo = Number(item?.tipo) || 0;
                const valor = (item?.valor ?? "").toString().trim();
                if (valor === "") {
                    throw new CustomException({
                        title: "Datos de contacto inválidos",
                        message: "contactosData.create requiere 'valor' no vacío",
                        status: Status.badRequest,
                    });
                }
                const ins = await executeQuery(
                    db,
                    `
            INSERT INTO clientes_contactos (didCliente, tipo, valor, quien, superado, elim, autofecha)
            VALUES (?, ?, ?, ?, 0, 0, NOW())
          `,
                    [Number(clienteId), tipo, valor, userId],
                    true
                );
                const id = ins.insertId;
                await executeQuery(db, `UPDATE clientes_contactos SET did = ? WHERE id = ?`, [id, id], true);
                contCreated.push({ id, did: id, didCliente: Number(clienteId), tipo, valor });
            }
            else if (action === "delete") {
                const didVal = Number(item?.did);
                if (!Number.isFinite(didVal) || didVal <= 0) {
                    throw new CustomException({
                        title: "Dato inválido",
                        message: "did inválido en contactosData.delete",
                        status: Status.badRequest,
                    });
                }
                const del = await executeQuery(
                    db,
                    `UPDATE clientes_contactos SET elim = 1 WHERE did = ? AND elim = 0`,
                    [didVal],
                    true
                );
                contDeleted.push({ did: didVal, affectedRows: del?.affectedRows ?? 0 });
            }
            else {
                throw new CustomException({
                    title: "Acción inválida",
                    message: `contactosData.action debe ser "create" o "delete"`,
                    status: Status.badRequest,
                });
            }
        }
    }

    // 7) Acciones sueltas: cuentas
    const ctaCreated = [];
    const ctaDeleted = [];
    if (Array.isArray(cuentasData)) {
        for (const item of cuentasData) {
            const action = String(item?.action || "").toLowerCase();

            if (action === "create") {
                const flex = Number(item?.flex ?? item?.tipo) || 0; // tu modelo usa 'flex' como tipo
                const rawData = item?.data ?? {};
                const dataStr = JSON.stringify(rawData);
                const depositos = (item?.depositos ?? "").toString();
                const titulo = (item?.titulo ?? "").toString();

                const ml_id_vendedor =
                    flex === 1 ? (rawData?.ml_id_vendedor ?? item?.ml_id_vendedor ?? "").toString() : "";
                const ml_user =
                    flex === 1 ? (rawData?.ml_user ?? item?.ml_user ?? "").toString() : "";

                const ins = await executeQuery(
                    db,
                    `
            INSERT INTO clientes_cuentas
              (didCliente, flex, data, depositos, titulo, ml_id_vendedor, ml_user, quien, superado, elim, autofecha)
            VALUES
              (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW())
          `,
                    [Number(clienteId), flex, dataStr, depositos, titulo, ml_id_vendedor, ml_user, userId],
                    true
                );
                const id = ins.insertId;
                await executeQuery(db, `UPDATE clientes_cuentas SET did = ? WHERE id = ?`, [id, id], true);
                ctaCreated.push({
                    id, did: id, didCliente: Number(clienteId), flex,
                    data: rawData, depositos, titulo, ml_id_vendedor, ml_user
                });
            }
            else if (action === "delete") {
                const didVal = Number(item?.did);
                if (!Number.isFinite(didVal) || didVal <= 0) {
                    throw new CustomException({
                        title: "Dato inválido",
                        message: "did inválido en cuentasData.delete",
                        status: Status.badRequest,
                    });
                }
                const del = await executeQuery(
                    db,
                    `UPDATE clientes_cuentas SET elim = 1 WHERE did = ? AND elim = 0`,
                    [didVal],
                    true
                );
                ctaDeleted.push({ did: didVal, affectedRows: del?.affectedRows ?? 0 });
            }
            else {
                throw new CustomException({
                    title: "Acción inválida",
                    message: `cuentasData.action debe ser "create" o "delete"`,
                    status: Status.badRequest,
                });
            }
        }
    }

    // 8) Respuesta
    return {
        success: true,
        message: "Cliente actualizado correctamente",
        data: {
            did: Number(clienteId),
            cliente: { nombre_fantasia: newNF, razon_social: newRS, codigo: newCOD, habilitado: newHAB, observaciones: newOBS },
            direcciones: {
                created: dirCreated.length ? dirCreated : undefined,
                deleted: dirDeleted.length ? dirDeleted : undefined
            },
            contactos: {
                created: contCreated.length ? contCreated : undefined,
                deleted: contDeleted.length ? contDeleted : undefined
            },
            cuentas: {
                created: ctaCreated.length ? ctaCreated : undefined,
                deleted: ctaDeleted.length ? ctaDeleted : undefined
            }
        },
        meta: { timestamp: new Date().toISOString() }
    };
}