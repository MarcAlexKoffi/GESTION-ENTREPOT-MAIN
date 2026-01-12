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

        if (colNames.includes('coperative') && !colNames.includes('cooperative')) {
            console.log("Renaming 'coperative' to 'cooperative'...");
            await db.query("ALTER TABLE trucks CHANGE coperative cooperative VARCHAR(255) NULL");
            console.log("Column renamed successfully.");
        } else if (colNames.includes('coperative') && colNames.includes('cooperative')) {
             console.log("Both columns exist. Migrating data from 'coperative' to 'cooperative'...");
             await db.query("UPDATE trucks SET cooperative = coperative WHERE cooperative IS NULL");
             await db.query("ALTER TABLE trucks DROP COLUMN coperative");
             console.log("Data migrated and old column dropped.");
        } else if (!colNames.includes('cooperative')) {
             console.log("'cooperative' column missing. Adding it...");
             await db.query("ALTER TABLE trucks ADD COLUMN cooperative VARCHAR(255) NULL");
             console.log("Column added.");
        } else {
            console.log("Schema looks correct ('cooperative' exists, 'coperative' does not).");
        }

    } catch (err) {
        console.error("Schema Fix Error:", err.message);
    } finally {
        await db.end();
    }
})();
