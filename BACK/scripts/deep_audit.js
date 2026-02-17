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
        console.log("--- TRUCKS WITH WAREHOUSE NAMES ---");
        const [rows] = await db.query(`
            SELECT t.id, t.immatriculation, t.entrepotId, w.name as warehouseName
            FROM trucks t
            JOIN warehouses w ON t.entrepotId = w.id
        `);
        console.log(JSON.stringify(rows, null, 2));

        console.log("\n--- ORPHANED TRUCKS (Invalid entrepotId) ---");
        const [orphans] = await db.query(`
            SELECT id, immatriculation, entrepotId
            FROM trucks
            WHERE entrepotId NOT IN (SELECT id FROM warehouses)
        `);
        console.log(JSON.stringify(orphans, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await db.end();
    }
})();
