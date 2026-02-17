const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestionentrepots'
};

async function checkSchema() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [warehouses] = await connection.query("SHOW CREATE TABLE warehouses");
    console.log("WAREHOUSES SCHEMA:");
    console.log(warehouses[0]['Create Table']);
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkSchema();
