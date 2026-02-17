const mysql = require('mysql2/promise');

(async () => {
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestionentrepots'
    });

    try {
        console.log("Checking columns in 'trucks' table...");
        const [cols] = await db.query("SHOW COLUMNS FROM trucks");
        const colNames = cols.map(c => c.Field);
        console.log("Current columns:", colNames.join(', '));

        if (!colNames.includes('cooperative')) {
            console.log("Column 'cooperative' is MISSING. Adding it...");
            await db.query("ALTER TABLE trucks ADD COLUMN cooperative VARCHAR(255) NULL");
            console.log("Column 'cooperative' added.");
        } else {
            console.log("Column 'cooperative' already exists.");
        }

        if (colNames.includes('coperative')) {
            console.log("Found legacy column 'coperative'. Migrating data...");
            await db.query("UPDATE trucks SET cooperative = coperative WHERE cooperative IS NULL AND coperative IS NOT NULL");
            console.log("Data migrated.");
        }

        console.log("Schema fix complete.");

    } catch (err) {
        console.error("Schema Fix Error:", err.message);
    } finally {
        await db.end();
    }
})();
