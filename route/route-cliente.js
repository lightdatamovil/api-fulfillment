const express = require('express');
const cliente = express.Router();



const { redisClient,getConnection, getCompanyById, getConnectionLocal } = require('../dbconfig');
const Usuario = require('../controller/cliente/usuario');
const Cliente = require('../controller/cliente/cliente');
const Cliente_cuenta = require('../controller/cliente/cliente-cuenta');



cliente.post('/usuario', async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
      
        if (data.operador === 'eliminar') {
            const usuario = new Usuario();
       const response=  await usuario.delete(connection, data.did);
       console.log("Respuesta de delete:", response);
       return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response
    });
    
        }
        else{

          const usuarioRegex = /^[a-zA-Z0-9_]+$/;  // Solo permite letras, números y guion bajo
          if (!usuarioRegex.test(data.usuario)) {
              return res.status(400).json({
                  estado: false,
                  message: "El campo 'usuario' no puede contener caracteres especiales ni espacios."
              });
          }



        // Crear nuevo producto
        const usuario = new Usuario(
            data.did ?? 0,
            data.nombre,
            data.apellido,
            data.mail,
            data.usuario,
            data.contraseña,
            data.imagen,
            data.habilitado,
            data.perfil,
            data.accesos,
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection
        );

        const usuarioResult = await usuario.insert();

        const usuarioId= usuarioResult.insertId;


    

        return res.status(200).json({
            estado: true,
            message: "Usuario creado correctamente",
            didUsuario: usuarioId
            
        });
    }
    } catch (error) {
        console.error('Error durante la operación:', error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error
        });
    } finally {
        connection.end();
    }
});

cliente.post("/login", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const usuario =  new Usuario();

    try {
        const response = await usuario.login(connection, data.usuario, data.contraseña,data.codigo,data.idEmpresa);

        return res.status(200).json({
            estado: true,
            usuario: response
        });
    } catch (error) {
        console.error('Error durante la operación:', error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error
        });
    } finally {
        connection.end();
    }
});


cliente.post("/getUsuarios", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const usuario = new Usuario();
  
    try {
      // Filtros dinámicos desde el body
      const filtros = {
        did: data.did,
        perfil: data.perfil,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        pagina: data.pagina
      };
  
      const response = await Usuario.getUsuarios(connection, filtros);
  
      return res.status(200).json({
        estado: true,
        usuarios: response
      });
    } catch (error) {
      console.error('Error durante la operación:', error);
      return res.status(500).json({
        estado: false,
        error: -1,
        message: error.message || error
      });
    } finally {
      connection.end();
    }
  });
  
  cliente.post("/getUsuarios", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const usuario = new Usuario();
  
    try {
      // Filtros dinámicos desde el body
      const filtros = {
        did: data.did,
        perfil: data.perfil,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        pagina: data.pagina
      };
  
      const response = await Usuario.getUsuarios(connection, filtros);
  
      return res.status(200).json({
        estado: true,
        usuarios: response
      });
    } catch (error) {
      console.error('Error durante la operación:', error);
      return res.status(500).json({
        estado: false,
        error: -1,
        message: error.message || error
      });
    } finally {
      connection.end();
    }
  });
  cliente.post("/getUsuariosById", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const usuario = new Usuario();
  
    try {
   
      const response = await Usuario.getUsuariosById(connection, data.did);
  
      return res.status(200).json({
        estado: true,
        usuario: response
      });
    } catch (error) {
      console.error('Error durante la operación:', error);
      return res.status(500).json({
        estado: false,
        error: -1,
        message: error.message || error
      }); 
    } finally {
      connection.end();
    }
  });


cliente.post('/cliente', async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);

    try {
      
        if (data.operador === 'eliminar') {
            const cliente = new Cliente();
       const response=  await cliente.delete(connection, data.did);
       console.log("Respuesta de delete:", response);
       return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response
    });
    
        }
        else{

        // Crear nuevo producto
        const cliente = new Cliente(
            data.did ?? 0,
            data.nombre_fantasia,
            data.habilitado,
  
            data.quien,
            data.superado ?? 0,
            data.elim ?? 0,
            connection
        );

        const clienteResult = await cliente.insert();

        const clienteId= clienteResult.insertId;


    

        return res.status(200).json({
            estado: true,
            message: "Cliente creado correctamente",
            didUsuario: clienteId
            
        });
    }
    } catch (error) {
        console.error('Error durante la operación:', error);
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error
        });
    } finally {
        connection.end();
    }
});

cliente.post ("/getClientes", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const cliente= new Cliente();
    try {
        const response = await cliente.getClientes(connection, data.did);
        return res.status(200).json({    
            estado: true,
            usuarios: response
        });
    } catch (error) {
        console.error('Error durante la operación:', error);    
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error
        })
    }
    finally {
        connection.end();
    }
});
    
cliente.post('/clienteCuenta', async (req, res) => {
  const data = req.body;
  const connection = await getConnectionLocal(data.idEmpresa);

  try {
    // Si el operador es "eliminar"
    if (data.operador === 'eliminar') {
      const clienteCuenta = new Cliente_cuenta();
      const response = await clienteCuenta.delete(connection, data.did);

      return res.status(200).json({
        estado: response.estado !== undefined ? response.estado : false,
        message: response.message || response
      });
    }

    // Si es creación o actualización
    const clienteCuenta = new Cliente_cuenta(
      data.did ?? 0,
      data.diCliente,
      data.tipo,
      JSON.stringify(data.data ?? {}), // Importante: guardar como string JSON
      data.depositos ?? "",
      data.quien ?? 0,
      data.superado ?? 0,
      data.elim ?? 0,
      connection
    );

    const clienteResult = await clienteCuenta.insert();
    const clienteId = clienteResult.insertId;

    return res.status(200).json({
      estado: true,
      message: "Cliente cuenta guardado correctamente",
      didUsuario: clienteId
    });

  } catch (error) {
    console.error('Error durante la operación:', error);
    return res.status(500).json({
      estado: false,
      error: -1,
      message: error.message || error
    });
  } finally {
    connection.end();
  }
});


cliente.post ("/getClientesCuentas", async (req, res) => {
    const data = req.body;
    const connection = await getConnectionLocal(data.idEmpresa);
    const cliente= new Cliente_cuenta();
    try {
        const response = await cliente.getClientes(connection, data.didCliente);
        return res.status(200).json({    
            estado: true,
            clienteCuentas: response
        });
    } catch (error) {
        console.error('Error durante la operación:', error);    
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error
        })
    }
    finally {
        connection.end();
    }
});

cliente.get("/", async (req, res) => {
    res.status(200).json({
        estado: true,
        mesanje: "Hola chris"
    });

});


module.exports = cliente;

