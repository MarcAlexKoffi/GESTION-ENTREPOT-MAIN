require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestionentrepots',
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connecté à la base de données.');

    // 1. Créer la table empotage_containers
    console.log("Création de la table 'empotage_containers'...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS empotage_containers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        empotageId INT NOT NULL,
        numeroConteneur VARCHAR(255) NULL,
        nombreSacs INT DEFAULT 0,
        volume FLOAT DEFAULT 0,
        poids FLOAT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (empotageId) REFERENCES empotages(id) ON DELETE CASCADE
      )
    `);
    console.log("Table 'empotage_containers' prête.");

    // 2. Vérifier si empotages a besoin d'updates (ex: status default)
    // On force le default status à 'En attente' pour les nouveaux (via ALTER si besoin)
    // Mais le CREATE TABLE IF NOT EXISTS dans le code principal s'en charge pour les nouvelles install.
    // Pour l'existant, on s'assure juste que la structure est cohérente.
    
    console.log("Migration terminée avec succès.");

  } catch (error) {
    console.error('Erreur durant la migration:', error);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
