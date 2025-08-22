import { CustomException, executeQuery, Status } from "lightdata-tools";

/**
 * Crea pedidos de forma masiva SIN usar clases.
 * Body:
 * {
 *   pedidos: [{
 *     codigoCliente?: number,
 *     numero_venta: string,
 *     observaciones?: string,
 *     fecha_venta?: string|null,      // "YYYY-MM-DD HH:mm:ss"
 *     id_envio?: number|null,         // se copia a ml_shipment_id
 *     nombre?: string,
 *     apellido?: string,
 *     total?: number|string,
 *     items?: [{ cantidad?: number, seller_sku?: string }]
 *   }]
 * }
 */
export async function createPedidosMasivos(connection, req) {
    const { pedidos } = req.body || {};
    const { userId } = req.user ?? {};

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
        throw new CustomException({
            title: "Datos inválidos",
            message: "Debe enviar un arreglo 'pedidos' con al menos un elemento.",
            status: Status.badRequest,
        });
    }

    // Helpers ---------------

    const esEstadoRepetido = async (number, nuevoEstado) => {
        const q = "SELECT status FROM pedidos WHERE number = ? AND elim = 0 AND superado = 0 LIMIT 1";
        const r = await executeQuery(connection, q, [number]);
        if (r.length === 0) return false;
        return r[0].status === nuevoEstado;
    };

    const insertRow = async (table, row) => {
        // inserta solo columnas existentes
        const desc = await executeQuery(connection, `DESCRIBE ${table}`, []);
        const cols = desc.map((c) => c.Field);
        const keys = Object.keys(row).filter((k) => cols.includes(k) && row[k] !== undefined);
        const vals = keys.map((k) => row[k]);
        const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`;
        const ins = await executeQuery(connection, sql, vals, true);
        return { insertId: ins.insertId };
    };

    // Proceso ---------------

    const summary = { ok: 0, skipped: 0, errors: 0 };
    const results = [];

    for (const p of pedidos) {
        const number = String(p?.numero_venta ?? "").trim();

        if (!number) {
            summary.errors++;
            results.push({ number: null, estado: false, error: "numero_venta requerido" });
            continue;
        }

        try {
            // Duplicado con estado "pendiente"
            if (await esEstadoRepetido(number, "pendiente")) {
                summary.skipped++;
                results.push({ number, estado: false, motivo: "Estado repetido (pendiente), salteado" });
                continue;
            }

            // ----- PEDIDO -----
            const pedidoRow = {
                didEnvio: p?.id_envio ?? null,
                didCliente: Number(p?.codigoCliente) || 0,
                didCuenta: 0,
                status: "pendiente",
                flex: 0,
                number,
                observaciones: (p?.observaciones ?? "").toString(),
                armado: 0,
                descargado: 0,
                fecha_armado: null,
                fecha_venta: p?.fecha_venta ?? null,
                quien_armado: 0,
                ml_shipment_id: p?.id_envio ?? null,
                ml_id: "",
                ml_pack_id: "",
                buyer_id: "",
                buyer_nickname: "",
                buyer_name: (p?.nombre ?? "").toString(),
                buyer_last_name: (p?.apellido ?? "").toString(),
                total_amount: p?.total ?? null,
                seller_sku: "",       // si tu tabla no lo tiene, borrá esta línea
                superado: 0,
                elim: 0,
                // autofecha: NOW() -> si tu tabla la setea por default, no hace falta
            };

            const insPedido = await insertRow("pedidos", pedidoRow);
            const pedidoId = insPedido.insertId;

            // did = id
            await executeQuery(connection, "UPDATE pedidos SET did = ? WHERE id = ?", [pedidoId, pedidoId], true);

            // ----- ITEMS -----
            const items = Array.isArray(p?.items) ? p.items : [];
            for (const it of items) {
                const itemRow = {
                    didPedido: pedidoId,
                    codigo: "",
                    imagen: "",
                    descripcion: "",
                    ml_id: "",
                    dimensions: "",
                    cantidad: Number(it?.cantidad) || 0,
                    variation_attributes: "",
                    seller_sku: (it?.seller_sku ?? "").toString(),
                    user_product_id: 0,
                    idVariacion: 0,
                    descargado: 0,
                    superado: 0,
                    elim: 0,
                };
                await insertRow("pedidos_items", itemRow);
            }

            // ----- HISTORIAL -----
            const histRow = {
                didPedido: pedidoId,
                estado: "pendiente",
                quien: userId ?? 0,
                superado: 0,
                elim: 0,
            };
            await insertRow("pedidos_historial", histRow);

            summary.ok++;
            results.push({ number, estado: true, did: pedidoId, items: items.length });
        } catch (err) {
            summary.errors++;
            results.push({ number, estado: false, error: err?.message || String(err) });
        }
    }

    return {
        success: true,
        message: "Proceso de subida masiva finalizado",
        summary,
        results,
        meta: { timestamp: new Date().toISOString() },
    };
}
