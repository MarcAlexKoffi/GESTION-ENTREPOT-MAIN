const mysql = require('mysql2/promise');
const fs = require('fs');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestionentrepots'
};

(async () => {
    const db = await mysql.createConnection(dbConfig);
    
    const [warehouses] = await db.query("SELECT * FROM warehouses");
    fs.writeFileSync('dump_warehouses.json', JSON.stringify(warehouses, null, 2));
    console.log("Dumped warehouses to dump_warehouses.json");

    await db.end();
})();
