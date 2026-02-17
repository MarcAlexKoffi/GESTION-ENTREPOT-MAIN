const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestionentrepots',
  port: 3306
};

async function repair() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connecté à la base de données pour réparation.");

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    // Fix Trucks
    console.log("Réparation table 'trucks'...");
    await connection.query("UPDATE trucks SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM (SELECT id FROM trucks) as t) WHERE id = 0");
    await connection.query("ALTER TABLE trucks MODIFY id INT NOT NULL AUTO_INCREMENT");
    await connection.query("ALTER TABLE trucks AUTO_INCREMENT = 1");

    // Fix Warehouses
    console.log("Réparation table 'warehouses'...");
    try {
      await connection.query("UPDATE warehouses SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM (SELECT id FROM warehouses) as w) WHERE id = 0");
      await connection.query("ALTER TABLE warehouses MODIFY id INT NOT NULL AUTO_INCREMENT");
    } catch (e) {}

    // Fix Users
    console.log("Réparation table 'users'...");
    try {
      await connection.query("UPDATE users SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM (SELECT id FROM users) as u) WHERE id = 0");
      await connection.query("ALTER TABLE users MODIFY id INT NOT NULL AUTO_INCREMENT");
    } catch (e) {}

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("Réparation terminée avec succès !");

    const [rows] = await connection.query("SHOW CREATE TABLE trucks");
    console.log("Nouveau schéma 'trucks':", rows[0]['Create Table']);

  } catch (err) {
    console.error("Erreur fatale lors de la réparation:", err);
  } finally {
    if (connection) await connection.end();
  }
}

repair();
