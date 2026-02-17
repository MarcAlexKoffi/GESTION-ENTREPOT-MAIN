const mysql = require('mysql2/promise');

(async () => {
    const db = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestionentrepots',
        port: 3306,
    });

    try {
        console.log("--- WAREHOUSES ---");
        const [warehouses] = await db.query("SELECT * FROM warehouses");
        console.log(JSON.stringify(warehouses, null, 2));

        console.log("\n--- TRUCKS ---");
        const [trucks] = await db.query("SELECT id, immatriculation, entrepotId FROM trucks");
        console.log(JSON.stringify(trucks, null, 2));

        console.log("\n--- USERS ---");
        const [users] = await db.query("SELECT id, username, entrepotId FROM users");
        console.log(JSON.stringify(users, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await db.end();
    }
})();
