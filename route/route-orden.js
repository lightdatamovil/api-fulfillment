const express = require("express");
const producto = express.Router();
const { getConnectionLocal, } = require("../dbconfig");
const verificarToken = require("../middleware/token");
const Orden_Trabajo = require("../controller/orden/ordenes_trabajo");
const Orden_trabajo_pedido = require("../controller/orden/ordenes_trabajo_pedido");
const Orden_trabajo_pedido_items = require("../controller/orden/ordenes_trabajo_pedido_items");
const ordenTrabajoEstado = require("../controller/orden/ordenes_trabajo_pedidos_estados");
const OrdenTrabajoEstado = require("../controller/orden/ordenes_trabajo_pedidos_estados");


producto.post("/postOrdenTrabajo", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
        // Crear nuevo producto
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

        const didPedido = data.did;


        return res.status(200).json({
            estado: true,
            didOrden: pedidoId,
        });
    } catch (error) {
        console.error("Error durante la operación:", error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});
producto.post("/postOrdenTrabajoPedido", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
        // Crear nuevo producto
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

        const didPedido = data.did;


        return res.status(200).json({
            estado: true,
            didOrden: pedidoId,
        });
    } catch (error) {
        console.error("Error durante la operación:", error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});
producto.post("/postOrdenTrabajoPedidoItem", verificarToken, async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
        // Crear nuevo producto
        const ordenTrabajoPedidoItem = new Orden_trabajo_pedido_items(
            data.did ?? 0,
            data.didOrden ?? 0,
            data.didPedido ?? 0,
            data.sku ?? "",
            data.habilitado ?? 0,
            data.canitidad ?? 0,
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

        const didPedido = data.did;


        return res.status(200).json({
            estado: true,
            didOrden: pedidoId,
        });
    } catch (error) {
        console.error("Error durante la operación:", error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});
producto.post("/postOrdenTrabajoEstados", verificarToken, async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
        // Crear nuevo producto
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

        const didPedido = data.did;


        return res.status(200).json({
            estado: true,
            didOrden: pedidoId,
        });
    } catch (error) {
        console.error("Error durante la operación:", error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});


producto.post("/getProductos", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const producto = new ProductO1();

    try {
        const response = await producto.traerProductos(connection, {
            pagina: data.pagina || 1,
            cantidad: data.cantidad || 10,
            titulo: data.titulo || "",
            sku: data.sku || "",
            habilitado: data.habilitado || "",
            esCombo: data.esCombo || "",
            cliente: data.cliente || "",
            ean: data.ean || "",
        });

        return res.status(200).json({
            estado: true,
            totalRegistros: response.totalRegistros,
            totalPaginas: response.totalPaginas,
            pagina: response.pagina,
            cantidad: response.cantidad,
            data: response.data,
        });
    } catch (error) {
        console.error("Error durante la operación:", error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});

producto.post("/getProductoById", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const producto = new ProductO1();
    const response = await producto.traerProductoId(connection, data.did);
    return res.status(200).json({
        estado: true,
        data: response,
    });
});
producto.post("/updateProducts", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const producto = new ProductO1(
        data.did ?? 0,
        data.cliente,
        data.sku,
        data.titulo,
        data.descripcion,
        data.imagen,
        data.habilitado,
        data.esCombo,
        data.posicion ?? "",
        data.quien,
        data.superado ?? 0,
        data.elim ?? 0,
        connection
    );
    const response = await producto.checkAndUpdateDidProducto(
        connection,
        data.did
    );
    return res.status(200).json({
        estado: true,
        productos: response,
    });
});


producto.post("/getProducts", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const producto = new ProductO1();
    const response = await producto.traerProductos(connection, data);
    return res.status(200).json({
        estado: true,
        productos: response,
    });
});

producto.get("/getAllProductos/:empresa", async (req, res) => {
    const empresa = req.params.empresa;
    if (!empresa) {
        return res.status(400).json({
            estado: false,
            message: "El ID de la empresa es requerido",
        });
    }
    const connection = await getConnectionLocal(empresa);
    const producto = new ProductO1();
    try {
        const response = await producto.traerProductosAll(connection);

        return res.status(200).json(response);
    } catch (error) {
        console.error("Error durante la operación:", error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error,
        });
    } finally {
        connection.end();
    }
});

producto.get("/", async (req, res) => {
    res.status(200).json({
        estado: true,
        mesanje: "Hola chris",
    });
});


module.exports = producto;
