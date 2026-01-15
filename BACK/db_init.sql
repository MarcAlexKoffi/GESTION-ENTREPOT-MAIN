-- Table: warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  location VARCHAR(150) NOT NULL,
  imageUrl TEXT DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','operator','driver','security') NOT NULL,
  entrepotId INT DEFAULT NULL,
  status ENUM('Actif','Inactif','En attente') DEFAULT 'En attente',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entrepotId) REFERENCES warehouses(id) ON DELETE SET NULL
);

-- Table: trucks
CREATE TABLE IF NOT EXISTS trucks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entrepotId INT NOT NULL,
  immatriculation VARCHAR(255) NOT NULL,
  transporteur VARCHAR(255) NOT NULL,
  transfert VARCHAR(255) DEFAULT NULL,
  statut VARCHAR(50) DEFAULT 'Enregistré',
  heureArrivee DATETIME DEFAULT CURRENT_TIMESTAMP,
  heureDepart DATETIME DEFAULT NULL,
  poids FLOAT DEFAULT NULL,
  metadata TEXT DEFAULT NULL,
  cooperative VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (entrepotId) REFERENCES warehouses(id) ON DELETE CASCADE
);

-- Table: truck_products
CREATE TABLE IF NOT EXISTS truck_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truckId INT NOT NULL,
  numeroLot VARCHAR(100) DEFAULT NULL,
  nombreSacsDecharges VARCHAR(50) DEFAULT NULL,
  poidsBrut VARCHAR(50) DEFAULT NULL,
  poidsNet VARCHAR(50) DEFAULT NULL,
  FOREIGN KEY (truckId) REFERENCES trucks(id) ON DELETE CASCADE
);

-- Table: truck_history
CREATE TABLE IF NOT EXISTS truck_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truckId INT NOT NULL,
  event TEXT NOT NULL,
  byRole ENUM('admin','gerant') NOT NULL,
  date DATETIME NOT NULL,
  FOREIGN KEY (truckId) REFERENCES trucks(id) ON DELETE CASCADE
);

-- Table: truck_admin_comments
CREATE TABLE IF NOT EXISTS truck_admin_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truckId INT NOT NULL,
  comment TEXT DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (truckId) REFERENCES trucks(id) ON DELETE CASCADE
);

-- Table: empotages (Celle qui manquait)
CREATE TABLE IF NOT EXISTS empotages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client VARCHAR(255) NULL,
  clientType VARCHAR(255) NULL,
  booking VARCHAR(255) NULL,
  conteneurs INT DEFAULT 0,
  volume FLOAT DEFAULT 0,
  dateStart DATETIME NULL,
  dateEnd DATETIME NULL,
  status VARCHAR(50) DEFAULT 'A venir',
  entrepotId INT DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: notifications (Celle qui manquait aussi)
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message TEXT NOT NULL,
  isRead BOOLEAN DEFAULT FALSE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  relatedId INT NULL,
  type VARCHAR(50) NULL
);
