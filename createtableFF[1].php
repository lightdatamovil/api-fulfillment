<?php

try {
	$redis = new Redis();
	$redis->connect('10.60.0.115', 6379); //192.99.190.137 Puerto: 50301

	// Autenticación con la contraseña de Redis
	if (!$redis->auth('sdJmdxXC8luknTrqmHceJS48NTyzExQg')) {
		die('Error: No se pudo autenticar en Redis.');
	}
	$get = $redis->get("empresasData"); 
	$Aempresas = json_decode($get, true);
	$redis->close();
} catch(Exception $e){

}

/*
 149.56.182.49:44347
		Usuario: root
		Contraseña: Ve5P4nAdt6UiT8
*/

$AempresasFF = [270,275];

$db_host = '149.56.182.49';
$db_puerto = '44347';
$db_usuario = 'root';
$db_password = 'Ve5P4nAdt6UiT8';

$mysqli = new mysqli($db_host, $db_usuario, $db_password, '', $db_puerto);

if ($mysqli->connect_error) {
    die("Error de conexión: " . $mysqli->connect_error);
} else {
    echo "Conexión exitosa al servidor MariaDB.";
}	

$Aschemasql = [];
$Aschemasql["usuarios"] = "CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    did INT NOT NULL,
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    mail VARCHAR(150),
    usuario VARCHAR(100),
    pass VARCHAR(256),
    imagen VARCHAR(255),
    habilitado INT DEFAULT 1,
    perfil INT,
    accesos VARCHAR(255),
    autofecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    superado INT DEFAULT 0,
    elim INT DEFAULT 0,

    INDEX idx_perfil (perfil),
    INDEX idx_did (did),
    INDEX idx_usuario (usuario),
    INDEX idx_superado (superado),
    INDEX idx_elim (elim)
);
";

$Aschemasql["clientes"] = "CREATE TABLE IF NOT EXISTS `clientes`  (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`did` int(11) NOT NULL,
	`quien` int(11) NULL DEFAULT NULL,
	`habilitado` int(11) NULL DEFAULT 1,
	`nombre_fantasia` varchar(150) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
	`autofecha` datetime NULL DEFAULT current_timestamp(),
	`elim` int(11) NULL DEFAULT 0,
	`superado` int(11) NULL DEFAULT 0,
	PRIMARY KEY (`id`) USING BTREE
  );
  
  ";

$Aschemasql["clientes_cuentas"] = "CREATE TABLE IF NOT EXISTS `clientes_cuentas`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `didCliente` int(11) NOT NULL,
  `data` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `ml_id_vendedor` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `ml_user` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `depositos` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `autofecha` datetime NULL DEFAULT current_timestamp(),
  `quien` int(11) NULL DEFAULT NULL,
  `superado` int(11) NULL DEFAULT 0,
  `elim` int(11) NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE
);  ";

$Aschemasql["depositos"] = "CREATE TABLE IF NOT EXISTS `depositos`  
(
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `direccion` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `codigo` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `email` varchar(150) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `telefono` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `autofecha` datetime NULL DEFAULT current_timestamp(),
  `superado` int(11) NULL DEFAULT 0,
  `elim` int(11) NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE
);";

$Aschemasql["ecommerces"] = "CREATE TABLE `ecommerces`  (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`did` int(11) NOT NULL,
	`nombre` varchar(150) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
	`autofecha` datetime NULL DEFAULT current_timestamp(),
	`superado` int(11) NULL DEFAULT 0,
	`elim` int(11) NULL DEFAULT 0,
	PRIMARY KEY (`id`) USING BTREE
  );";

$Aschemasql["productos"] = "CREATE TABLE IF NOT EXISTS `productos`  (
`id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `didCliente` int(11) NOT NULL,
  `sku` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `titulo` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `descripcion` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `imagen` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `habilitado` int(11) NOT NULL DEFAULT 0,
  `esCombo` int(11) NOT NULL DEFAULT 0,
  `autofecha` datetime NULL DEFAULT current_timestamp(),
  `quien` int(11) NULL DEFAULT NULL,
  `superado` int(11) NULL DEFAULT 0,
  `elim` int(11) NULL DEFAULT 0,
  `posicion` varchar(128) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
);
";

$Aschemasql["productos_combos"] =  "CREATE TABLE IF NOT EXISTS `productos_combos`  (

  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `didProducto` int(11) NOT NULL,
  `cantidad` double NOT NULL,
  `autofecha` datetime NULL DEFAULT current_timestamp(),
  `superado` int(11) NOT NULL DEFAULT 0,
  `elim` int(11) NOT NULL DEFAULT 0,
  `quien` int(11) NOT NULL,
  `combo` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL CHECK (json_valid(`combo`)),
  PRIMARY KEY (`id`) USING BTREE
);
";

$Aschemasql["productos_ecommerce"] = "CREATE TABLE IF NOT EXISTS `productos_ecommerce`  (

  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `didProducto` int(11) NOT NULL,
  `didVariante` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `flex` int(11) NOT NULL,
  `url` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `habilitado` int(11) NOT NULL DEFAULT 0,
  `sync` int(11) NOT NULL DEFAULT 0,
  `autofecha` datetime NULL DEFAULT current_timestamp(),
  `quien` int(11) NULL DEFAULT NULL,
  `superado` int(11) NOT NULL DEFAULT 0,
  `elim` int(11) NOT NULL DEFAULT 0,
  `sku` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
);	
";

$Aschemasql["productos_depositos"] = "CREATE TABLE IF NOT EXISTS `productos_depositos`  (

  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `didProducto` int(11) NOT NULL,
  `didDeposito` int(11) NOT NULL,
  `habilitado` int(11) NOT NULL DEFAULT 0,
  `autofecha` datetime NULL DEFAULT current_timestamp(),
  `quien` int(11) NOT NULL,
  `superado` int(11) NOT NULL DEFAULT 0,
  `elim` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE
);	
";


$Aschemasql["stock"] = "CREATE TABLE IF NOT EXISTS `stock`  (

  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `didProducto` int(11) NOT NULL,
  `didVariante` int(11) NOT NULL,
  `cantidad` float NOT NULL,
  `quien` int(11) NULL DEFAULT NULL,
  `superado` tinyint(4) NULL DEFAULT 0,
  `elim` tinyint(4) NULL DEFAULT 0,
  `autofecha` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ;
";

$Aschemasql["stock_consolidado"] = "CREATE TABLE IF NOT EXISTS `stock_consolidado`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `didProducto` int(11) NOT NULL,
  `didVariante` int(11) NOT NULL,
  `stock` int(11) NOT NULL,
  `autofecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `quien` int(11) NULL DEFAULT NULL,
  `superado` tinyint(4) NULL DEFAULT 0,
  `elim` tinyint(4) NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE
);
";

$Aschemasql["producto_variaciones"] = "CREATE TABLE IF NOT EXISTS `producto_variaciones`  (

 `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NULL DEFAULT NULL,
  `didProducto` int(11) NULL DEFAULT NULL,
  `sku` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `cantidad` int(11) NULL DEFAULT 0,
  `variante` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `habilitado` int(11) NULL DEFAULT 1,
  `quien` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `superado` int(11) NULL DEFAULT 0,
  `elim` int(11) NULL DEFAULT 0,
  `autofecha` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
);
";

$Aschemasql["ordenes"] = "CREATE TABLE IF NOT EXISTS `ordenes`  (
  
 
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `didEnvio` int(11) NOT NULL,
  `didCliente` int(11) NOT NULL,
  `didCuenta` int(11) NOT NULL,
  `status` varchar(32) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `flex` int(11) NOT NULL,
  `number` varchar(64) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `fecha_venta` datetime NOT NULL,
  `observaciones` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `armado` int(11) NOT NULL COMMENT '0 =no ` 1=si',
  `descargado` int(11) NOT NULL DEFAULT 0,
  `quien_armado` int(11) NOT NULL,
  `autofecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `superado` int(11) NOT NULL DEFAULT 0,
  `elim` int(11) NOT NULL DEFAULT 0,
  `ml_shipment_id` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `ml_id` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `ml_pack_id` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `buyer_id` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `buyer_nickname` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `buyer_name` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `buyer_last_name` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `total_amount` float NULL DEFAULT NULL,
  `fecha_armado` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`id`, `ml_shipment_id`, `ml_id`, `ml_pack_id`, `superado`, `fecha_venta`, `autofecha`, `did`, `didEnvio`, `didCliente`, `didCuenta`, `flex`, `number`, `buyer_id`) USING BTREE
)
";

$Aschemasql["ordenes_items"] = "CREATE TABLE IF NOT EXISTS `ordenes_items`  (

  `id` int(11) NOT NULL AUTO_INCREMENT,
  `didOrden` int(11) NOT NULL,
  `codigo` varchar(128) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `imagen` varchar(256) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `descripcion` varchar(512) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `ml_id` varchar(128) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `dimensions` varchar(64) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `cantidad` int(11) NOT NULL,
  `variacion` varchar(64) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `seller_sku` varchar(64) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `descargado` int(11) NOT NULL DEFAULT 0,
  `autofecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `superado` int(11) NOT NULL DEFAULT 0,
  `elim` int(11) NOT NULL DEFAULT 0,
  `idVariacion` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `user_product_id` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `variation_attributes` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`, `seller_sku`, `idVariacion`, `elim`, `superado`) USING BTREE
);
";

$Aschemasql["atributos"] = "CREATE TABLE IF NOT EXISTS `atributos`  (


  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `descripcion` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `orden` int(11) NULL DEFAULT 0,
  `habilitado` tinyint(1) NULL DEFAULT 1,
  `did` int(11) NULL DEFAULT NULL,
  `quien` int(11) NULL DEFAULT NULL,
  `superado` int(11) NULL DEFAULT NULL,
  `elim` int(11) NULL DEFAULT NULL,
`autofecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `codigo` varchar(6) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
 
); ";

$Aschemasql["atributos_valores"] = "CREATE TABLE IF NOT EXISTS `atributos_valores`  (

  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` int(11) NOT NULL,
  `codigo` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `didProducto` int(11) NOT NULL,
  `didAtributo` int(11) NOT NULL,
  `valor` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `habilitado` int(11) NOT NULL DEFAULT 0,
`autofecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `quien` int(11) NULL DEFAULT NULL,
  `superado` int(11) NULL DEFAULT 0,
  `elim` int(11) NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE
); ";

$Aschemasql["sistema_empresa"] = "CREATE TABLE IF NOT EXISTS `sistema_empresa`  (

  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'autoincrement ',
  `did` int(11) NOT NULL,
  `nombre` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `codigo` varchar(6) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `tipo` int(11) NOT NULL DEFAULT 1,
  `superado` int(11) NOT NULL DEFAULT 0,
  `elim` int(11) NOT NULL DEFAULT 0,
`autofecha` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
);";

$Aschemasql["ordenes_historial"] = "CREATE TABLE IF NOT EXISTS `ordenes_historial`  (

 `id` int(11) NOT NULL AUTO_INCREMENT,
  `didOrden` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `estado` int(11) NULL DEFAULT NULL,
  `fecha` datetime NULL DEFAULT NULL,
  `autofecha` timestamp NULL DEFAULT NULL,
  `superado` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `elim` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `quien` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
);";


foreach($Aempresas as $empresa){
	
	$idempresa = $empresa["id"];
	
	if(in_array($idempresa, $AempresasFF)){
	
		$db_nombre = 'empresa_'.$idempresa;
		$db_username = 'ue'.$idempresa;
		
		$mysqli->select_db($db_nombre);
		
		$Atables = ['clientes', 'clientes_cuentas', 'usuarios', 'productos_depositos', 'productos', 'productos_ecommerce','productos_combos', 'stock' ,"stock_consolidado", 'ecommerces', 'ordenes', 'ordenes_items',"depositos","atributos","atributos_valores","sistema_empresa", "producto_variaciones"];
				
		foreach($Atables as $schema){
			
			if(isset($Aschemasql[$schema])){
				$result = $mysqli->query("SHOW TABLES LIKE '$schema'");
				if ($result->num_rows > 0) {
					echo "La tabla '$schema' ya existe.<br>";
				} else {
					echo "La tabla '$schema' no existe. Creándola...<br>";
					if ($mysqli->query($Aschemasql[$schema])) {
						echo "Tabla '$schema' creada exitosamente.<br>";
					} else {
						echo "Error al crear la tabla '$schema': " . $mysqli->error;
					}
				}				
			}
		
		}

		$result = $mysqli->query("SELECT COUNT(*) as count FROM mysql.user WHERE user = '$db_username'");
		$row = $result->fetch_assoc();
		if ($row['count'] > 0) {
			echo "El usuario '$db_username' ya existe.<br>";
		} else {
			echo "El usuario '$db_username' no existe. Creándolo... '78451296_{$idempresa}' <br>";
			$mysqli->query("CREATE USER '$db_username'@'%' IDENTIFIED BY '78451296_{$idempresa}';");
			$mysqli->query("GRANT ALL PRIVILEGES ON $db_nombre.* TO '$db_username'@'%';");
			$mysqli->query("FLUSH PRIVILEGES;");
			echo "Usuario '$db_username' creado exitosamente.<br>";
		}
	
	}
	
}

$mysqli->close();

?>