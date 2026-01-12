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
        console.log("--- USERS ---");
        const [users] = await db.query("SELECT id, nom, username, role, entrepotId FROM users");
        require('fs').writeFileSync('users_status.json', JSON.stringify(users, null, 2));
        console.log("Results saved to users_status.json");

    } catch (err) {
        console.error(err);
    } finally {
        await db.end();
    }
})();
