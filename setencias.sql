-- Tabla: productos
CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    did INT NOT NULL,
    didCliente INT NOT NULL,
    sku VARCHAR(50),
    titulo VARCHAR(100),
    descripcion TEXT,
    imagen VARCHAR(255),
    habilitado INT NOT NULL DEFAULT 0,
    esCombo INT NOT NULL DEFAULT 0,
    posicion VARCHAR(128),
    autofecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    quien INT,
    superado INT DEFAULT 0,
    elim INT DEFAULT 0
);

-- Tabla: productos_combos
CREATE TABLE IF NOT EXISTS productos_combos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    did INT NOT NULL,
    didProducto INT NOT NULL,
    cantidad DOUBLE NOT NULL,
    autofecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    superado INT NOT NULL DEFAULT 0,
    elim INT NOT NULL DEFAULT 0,
    quien INT NOT NULL,
    combo JSON
);

-- Tabla: productos_depositos
CREATE TABLE IF NOT EXISTS productos_depositos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    did INT NOT NULL,
    didProducto INT NOT NULL,
    didDeposito INT NOT NULL,
    habilitado INT NOT NULL DEFAULT 0,
    autofecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    quien INT NOT NULL,
    superado INT NOT NULL DEFAULT 0,
    elim INT NOT NULL DEFAULT 0
);

-- Tabla: productos_ecommerces
CREATE TABLE IF NOT EXISTS productos_ecommerces (
    id INT AUTO_INCREMENT PRIMARY KEY,
    did INT NOT NULL,
    didProducto INT NOT NULL,
    flex INT NOT NULL,
    url VARCHAR(255) NOT NULL,
    habilitado INT NOT NULL DEFAULT 0,
    sync INT NOT NULL DEFAULT 0,
    autofecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    quien INT,
    superado INT NOT NULL DEFAULT 0,
    elim INT NOT NULL DEFAULT 0
);
