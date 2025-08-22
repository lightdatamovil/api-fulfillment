import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Alta de cliente y derivados (direcciones, contactos, cuentas).
 * - NO edita, NO borra, NO versiona: solo inserta.
 * Body:
 * {
 *   nombre_fantasia: string (req),
 *   razon_social?: string,
 *   codigo?: string,
 *   habilitado?: 0|1,
 *   observaciones?: string,
 *   direcciones?: Array<{ data?: object }>,
 *   contactos?:   Array<{ tipo?: number, valor?: string }>,
 *   cuentas?:     Array<{ tipo?: number, flex?: number, data?: object, depositos?: string, titulo?: string, ml_id_vendedor?: string, ml_user?: string }>
 * }
 */
export async function createCliente(db, req) {
    const {
        nombre_fantasia,
        razon_social,
        codigo,
        habilitado,
        observaciones,
        direcciones,
        contactos,
        cuentas,
    } = req.body || {};
    const { userId } = req.user ?? {};

    const nf = String(nombre_fantasia).trim();
    const rs = isNonEmpty(razon_social) ? String(razon_social).trim() : null;
    const cod = isNonEmpty(codigo) ? String(codigo).trim() : null;
    const obs = isNonEmpty(observaciones) ? String(observaciones).trim() : null;

    let habValue = 1;
    if (isDefined(habilitado)) {
        const h = number01(habilitado);
        if (h !== 0 && h !== 1) {
            throw new CustomException({
                title: "Valor inválido",
                message: "habilitado debe ser 0 o 1",
                status: Status.badRequest,
            });
        }
        habValue = h;
    }

    // ---------- Duplicados (cliente activo) ----------
    const dupNF = await executeQuery(
        db,
        `SELECT did FROM clientes WHERE nombre_fantasia = ? AND superado = 0 AND elim = 0 LIMIT 1`,
        [nf]
    );
    if (dupNF?.length) {
        throw new CustomException({
            title: "Duplicado",
            message: `Ya existe un cliente activo con nombre_fantasia "${nf}"`,
            status: Status.conflict,
        });
    }
    if (cod) {
        const dupCod = await executeQuery(
            db,
            `SELECT did FROM clientes WHERE codigo = ? AND superado = 0 AND elim = 0 LIMIT 1`,
            [cod]
        );
        if (dupCod?.length) {
            throw new CustomException({
                title: "Duplicado",
                message: `Ya existe un cliente activo con código "${cod}"`,
                status: Status.conflict,
            });
        }
    }

    // ---------- Insert cliente ----------
    const ins = await executeQuery(
        db,
        `
      INSERT INTO clientes
        (nombre_fantasia, razon_social, codigo, habilitado, observaciones, quien, superado, elim, autofecha)
      VALUES
        (?, ?, ?, ?, ?, ?, 0, 0, NOW())
    `,
        [nf, rs, cod, habValue, obs, userId],
        true
    );
    if (!ins?.affectedRows) {
        throw new CustomException({
            title: "Error al crear cliente",
            message: "No se pudo insertar el cliente",
            status: Status.internalServerError,
        });
    }
    const clienteId = ins.insertId;

    // did = id
    await executeQuery(
        db,
        `UPDATE clientes SET did = ? WHERE id = ?`,
        [clienteId, clienteId],
        true
    );

    // ========= Direcciones (solo ALTA) =========
    const insertedDirecciones = [];
    if (Array.isArray(direcciones) && direcciones.length > 0) {
        for (const d of direcciones) {
            const dataStr = JSON.stringify(d ?? {});
            const insDir = await executeQuery(
                db,
                `
          INSERT INTO clientes_direcciones
            (didCliente, data, quien, superado, elim, autofecha)
          VALUES
            (?, ?, ?, 0, 0, NOW())
        `,
                [clienteId, dataStr, userId],
                true
            );
            const dirId = insDir.insertId;
            await executeQuery(db, `UPDATE clientes_direcciones SET did = ? WHERE id = ?`, [dirId, dirId], true);
            insertedDirecciones.push({ id: dirId, did: dirId, didCliente: clienteId, data: JSON.parse(dataStr || "{}") });
        }
    }

    // ========= Contactos (solo ALTA) =========
    const insertedContactos = [];
    if (Array.isArray(contactos) && contactos.length > 0) {
        for (const c of contactos) {
            const tipo = Number(c?.tipo) || 0;
            const valor = (c?.valor ?? "").toString().trim();
            if (valor === "") {
                throw new CustomException({
                    title: "Datos de contacto inválidos",
                    message: "Cada contacto debe incluir 'valor' (no vacío)",
                    status: Status.badRequest,
                });
            }
            const insCont = await executeQuery(
                db,
                `
          INSERT INTO clientes_contactos
            (didCliente, tipo, valor, quien, superado, elim, autofecha)
          VALUES
            (?, ?, ?, ?, 0, 0, NOW())
        `,
                [clienteId, tipo, valor, userId],
                true
            );
            const contId = insCont.insertId;
            await executeQuery(db, `UPDATE clientes_contactos SET did = ? WHERE id = ?`, [contId, contId], true);
            insertedContactos.push({ id: contId, did: contId, didCliente: clienteId, tipo, valor });
        }
    }

    // ========= Cuentas (solo ALTA) =========
    const insertedCuentas = [];
    if (Array.isArray(cuentas) && cuentas.length > 0) {
        for (const c of cuentas) {
            const flex = Number(c?.flex ?? c?.tipo) || 0; // tu modelo usa 'flex' como tipo
            const rawData = c?.data ?? {};
            const dataStr = JSON.stringify(rawData);
            const depositos = (c?.depositos ?? "").toString();
            const titulo = (c?.titulo ?? "").toString();

            const ml_id_vendedor =
                flex === 1 ? (rawData?.ml_id_vendedor ?? c?.ml_id_vendedor ?? "").toString() : "";
            const ml_user =
                flex === 1 ? (rawData?.ml_user ?? c?.ml_user ?? "").toString() : "";

            const insCta = await executeQuery(
                db,
                `
          INSERT INTO clientes_cuentas
            (didCliente, flex, data, depositos, titulo, ml_id_vendedor, ml_user, quien, superado, elim, autofecha)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW())
        `,
                [clienteId, flex, dataStr, depositos, titulo, ml_id_vendedor, ml_user, userId],
                true
            );
            const ctaId = insCta.insertId;
            await executeQuery(db, `UPDATE clientes_cuentas SET did = ? WHERE id = ?`, [ctaId, ctaId], true);
            insertedCuentas.push({
                id: ctaId,
                did: ctaId,
                didCliente: clienteId,
                flex,
                data: rawData,
                depositos,
                titulo,
                ml_id_vendedor,
                ml_user,
            });
        }
    }

    // ---------- Respuesta ----------
    return {
        success: true,
        message: "Cliente creado correctamente",
        data: {
            id: clienteId,
            did: clienteId,
            nombre_fantasia: nf,
            razon_social: rs,
            codigo: cod,
            habilitado: habValue,
            observaciones: obs,
            direcciones: insertedDirecciones,
            contactos: insertedContactos,
            cuentas: insertedCuentas,
            quien: userId,
        },
        meta: { timestamp: new Date().toISOString() },
    };
}

/* ----------------- Helpers ----------------- */
const isDefined = (v) => v !== undefined && v !== null;
const isNonEmpty = (v) => isDefined(v) && (typeof v !== "string" || v.trim() !== "");
const number01 = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) return -1;
    return n === 1 ? 1 : n === 0 ? 0 : -1;
};
