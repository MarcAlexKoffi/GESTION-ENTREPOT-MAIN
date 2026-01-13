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
        const [rows] = await db.query("DESCRIBE empotages");
        console.log("Schema of empotages:", rows);
    } catch (err) {
        console.error("Error describing empotages:", err.message);
    } finally {
        await db.end();
    }
})();
