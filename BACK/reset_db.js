const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestionentrepots'
};

async function reset() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connecté.");

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    
    // Get all tables
    const [tables] = await connection.query("SHOW TABLES");
    const dbName = 'Tables_in_gestionentrepots';
    
    for (const row of tables) {
      const tableName = row[dbName];
      console.log(`Suppression de la table ${tableName}...`);
      await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("Base de données vidée avec succès !");

  } catch (err) {
    console.error("ERREUR:", err.message);
  } finally {
    if (connection) await connection.end();
  }
}

reset();
