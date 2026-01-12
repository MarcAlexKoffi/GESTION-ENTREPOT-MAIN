const mysql = require('mysql2/promise');

(async () => {
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestionentrepots'
    });

    try {
        const fs = require('fs');
        const outputFile = 'db_schema_output.txt';
        fs.writeFileSync(outputFile, "--- Tables in database ---\n");
        const [tables] = await db.query("SHOW TABLES");
        fs.appendFileSync(outputFile, `Tables found: ${tables.length}\n`);

        for (const tableObj of tables) {
            const tableName = Object.values(tableObj)[0];
            fs.appendFileSync(outputFile, `\n--- Create Table: ${tableName} ---\n`);
            const [createResult] = await db.query(`SHOW CREATE TABLE \`${tableName}\``);
            fs.appendFileSync(outputFile, createResult[0]['Create Table'] + "\n");
            fs.appendFileSync(outputFile, "-----------------------------------\n");
        }
        console.log("Schema written to db_schema_output.txt");

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await db.end();
    }
})();
