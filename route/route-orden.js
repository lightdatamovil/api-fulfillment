import { Router } from "express";
import Orden_Trabajo from "../controller/orden/ordenes_trabajo.js";
import Orden_trabajo_pedido from "../controller/orden/ordenes_trabajo_pedido.js";
import Orden_trabajo_pedido_items from "../controller/orden/ordenes_trabajo_pedido_items.js";
import OrdenTrabajoEstado from "../controller/orden/ordenes_trabajo_pedidos_estados.js";
import { getFFProductionDbConfig } from "lightdata-tools";
import { hostFulFillement, portFulFillement } from "../db.js";

const orden = Router();

orden.post("/postOrdenTrabajo", async (req, res) => {
    const data = req.body;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

    try {
        const ordenTrabajo = new Orden_Trabajo(
            data.did ?? 0,
            data.estado ?? "",
            data.asignada ?? "",
            data.fecha_inicio ?? 0,
            data.fecha_fin ?? "",
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection

        );

        const pedidoResultado = await ordenTrabajo.insert();

        if (pedidoResultado.estado === false) {
            return res
                .status(400)
                .json({ status: false, message: pedidoResultado.message });
        }

        let pedidoId = pedidoResultado.insertId;
        if (
            data.did != 0 &&
            data.did != null &&
            data.did != undefined &&
            data.did != ""
        ) {
            pedidoId = data.did;
        }

        return res.status(200).json({
            estado: true,
            didOrdenTrabajo: pedidoId,
        });
    } catch (error) {
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});
orden.post("/postOrdenTrabajoPedido", async (req, res) => {
    const data = req.body;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

    try {
        const ordenTrabajoPedido = new Orden_trabajo_pedido(
            data.did ?? 0,
            data.didOrden ?? 0,
            data.didPedidoHabbilitado ?? 0,
            data.flex ?? 0,
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection

        );

        const pedidoResultado = await ordenTrabajoPedido.insert();

        if (pedidoResultado.estado === false) {
            return res
                .status(400)
                .json({ status: false, message: pedidoResultado.message });
        }

        let pedidoId = pedidoResultado.insertId;
        if (
            data.did != 0 &&
            data.did != null &&
            data.did != undefined &&
            data.did != ""
        ) {
            pedidoId = data.did;
        }


        return res.status(200).json({
            estado: true,
            didOrdenapedido: pedidoId,
        });
    } catch (error) {
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});
orden.post("/postOrdenTrabajoPedidoItem", async (req, res) => {
    const data = req.body;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

    try {
        const ordenTrabajoPedidoItem = new Orden_trabajo_pedido_items(
            data.did ?? 0,
            data.didOrden ?? 0,
            data.didPedido ?? 0,
            data.sku ?? "",
            data.habilitado ?? 0,
            data.cantidad ?? 0,
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection
        );

        const pedidoResultado = await ordenTrabajoPedidoItem.insert();

        if (pedidoResultado.estado === false) {
            return res
                .status(400)
                .json({ status: false, message: pedidoResultado.message });
        }

        let pedidoId = pedidoResultado.insertId;
        if (
            data.did != 0 &&
            data.did != null &&
            data.did != undefined &&
            data.did != ""
        ) {
            pedidoId = data.did;
        }



        return res.status(200).json({
            estado: true,
            didOrdenPedidoItem: pedidoId,
        });
    } catch (error) {
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});
orden.post("/postOrdenTrabajoEstado", async (req, res) => {
    const data = req.body;
    const connection = getFFProductionDbConfig(data.idEmpresa, hostFulFillement, portFulFillement);

    try {
        const ordenTrabajoEstado = new OrdenTrabajoEstado(
            data.did ?? 0,
            data.didOrden ?? 0,
            data.didPedido ?? 0,
            data.estado ?? "",
            data.fecha ?? "",
            data.sku ?? "",
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection

        );

        const pedidoResultado = await ordenTrabajoEstado.insert();

        if (pedidoResultado.estado === false) {
            return res
                .status(400)
                .json({ status: false, message: pedidoResultado.message });
        }

        let pedidoId = pedidoResultado.insertId;
        if (
            data.did != 0 &&
            data.did != null &&
            data.did != undefined &&
            data.did != ""
        ) {
            pedidoId = data.did;
        }



        return res.status(200).json({
            estado: true,
            didOrdenPedidoEstado: pedidoId,
        });
    } catch (error) {
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});

export default orden;
