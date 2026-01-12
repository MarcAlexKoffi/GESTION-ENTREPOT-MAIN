const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestionentrepots'
};

(async () => {
    try {
        const db = await mysql.createConnection(dbConfig);
        console.log("Connected to DB.");
        
        console.log("Fetching last 5 trucks...");
        const [rows] = await db.query("SELECT id, immatriculation, heureArrivee, statut FROM trucks ORDER BY id DESC LIMIT 5");
        
        console.log(`Found ${rows.length} rows.`);

        console.log("---------------------------------------------------");
        rows.forEach(r => {
            console.log(`ID: ${r.id}, Immat: ${r.immatriculation}, HeureArrivee: ${r.heureArrivee} (Type: ${typeof r.heureArrivee}), Statut: ${r.statut}`);
            // Check if it's a date object
            if (r.heureArrivee instanceof Date) {
                console.log(`   -> As ISO: ${r.heureArrivee.toISOString()}`);
            } else {
                console.log(`   -> Value: ${r.heureArrivee}`);
            }
        });
        console.log("---------------------------------------------------");

        await db.end();
    } catch (e) {
        console.error("Error:", e);
    }
})();
