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
        const [trucks] = await db.query("SELECT id, immatriculation, entrepotId FROM trucks");
        console.log(JSON.stringify(trucks, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await db.end();
    }
})();
