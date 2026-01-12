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
        const results = {};
        const [warehouses] = await db.query("SELECT id, name, location FROM warehouses");
        results.warehouses = warehouses;

        const [counts] = await db.query("SELECT entrepotId, COUNT(*) as count FROM trucks GROUP BY entrepotId");
        results.trucks_per_warehouse = counts;

        const [recent] = await db.query("SELECT id, entrepotId, immatriculation, transporteur FROM trucks ORDER BY id DESC LIMIT 10");
        results.recent_trucks = recent;

        require('fs').writeFileSync('full_db_status.json', JSON.stringify(results, null, 2));
        console.log("Results saved to full_db_status.json");

    } catch (err) {
        console.error(err);
    } finally {
        await db.end();
    }
})();
