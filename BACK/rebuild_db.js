const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestionentrepots'
};

async function rebuild() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connecté.");

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.query("DROP TABLE IF EXISTS trucks");
    await connection.query(`
      CREATE TABLE trucks (
        id INT NOT NULL AUTO_INCREMENT,
        entrepotId INT NOT NULL,
        immatriculation VARCHAR(255) NOT NULL,
        transporteur VARCHAR(255) NOT NULL,
        transfert VARCHAR(255),
        coperative VARCHAR(255),
        statut VARCHAR(50) DEFAULT 'Enregistré',
        heureArrivee DATETIME DEFAULT CURRENT_TIMESTAMP,
        heureDepart DATETIME,
        poids FLOAT,
        metadata TEXT,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("Succès !");

  } catch (err) {
    console.error("ERREUR:", err.message);
  } finally {
    if (connection) await connection.end();
  }
}

rebuild();
