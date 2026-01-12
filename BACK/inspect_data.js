const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestionentrepots'
};

(async () => {
    const db = await mysql.createConnection(dbConfig);
    console.log("--- WAREHOUSES ---");
    const [warehouses] = await db.query("SELECT id, name, location FROM warehouses");
    console.log(JSON.stringify(warehouses, null, 2));

    console.log("\n--- TRUCKS Sample ---");
    const [trucks] = await db.query("SELECT id, entrepotId, immatriculation FROM trucks LIMIT 10");
    console.log(JSON.stringify(trucks, null, 2));

    await db.end();
})();
