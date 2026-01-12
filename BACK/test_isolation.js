const axios = require('axios');
const mysql = require('mysql2/promise');

(async () => {
    // 1. Establish direct DB connection to ensure clean state or known data
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestionentrepots'
    });

    try {
        console.log("--- SETUP: Ensuring Warehouses 1 and 2 exist ---");
        await db.query("INSERT IGNORE INTO warehouses (id, name, location) VALUES (1, 'Abidjan', 'Abidjan')");
        await db.query("INSERT IGNORE INTO warehouses (id, name, location) VALUES (2, 'Yamoussoukro', 'Yamoussoukro')");

        console.log("--- SETUP: Insert distinctive trucks ---");
        // Clear test trucks
        await db.query("DELETE FROM trucks WHERE transporteur LIKE 'TEST_%'");
        
        // Insert Truck for Abidjan (1)
        const [res1] = await db.query(`
            INSERT INTO trucks (entrepotId, immatriculation, transporteur, statut, heureArrivee) 
            VALUES (1, 'ABJ-001', 'TEST_ABIDJAN', 'Enregistré', NOW())
        `);
        console.log("Created Abidjan Truck ID:", res1.insertId);

        // Insert Truck for Yamoussoukro (2)
        const [res2] = await db.query(`
            INSERT INTO trucks (entrepotId, immatriculation, transporteur, statut, heureArrivee) 
            VALUES (2, 'YAM-001', 'TEST_YAMOU', 'Enregistré', NOW())
        `);
        console.log("Created Yamoussoukro Truck ID:", res2.insertId);

        // 2. Test API Query for Abidjan
        console.log("\n--- TEST: GET /api/trucks?entrepotId=1 ---");
        const respAbj = await axios.get('http://localhost:3000/api/trucks?entrepotId=1');
        const abjTrucks = respAbj.data.filter(t => t.transporteur.startsWith('TEST_'));
        console.log("Abidjan Trucks Found:", abjTrucks.map(t => `${t.id} - ${t.transporteur}`));
        
        if (abjTrucks.some(t => t.entrepotId !== 1)) {
            console.error("FAIL: Found non-Abidjan trucks in Abidjan query!");
        } else {
            console.log("PASS: Only Abidjan trucks found.");
        }

        // 3. Test API Query for Yamoussoukro
        console.log("\n--- TEST: GET /api/trucks?entrepotId=2 ---");
        const respYam = await axios.get('http://localhost:3000/api/trucks?entrepotId=2');
        const yamTrucks = respYam.data.filter(t => t.transporteur.startsWith('TEST_'));
        console.log("Yamoussoukro Trucks Found:", yamTrucks.map(t => `${t.id} - ${t.transporteur}`));

        if (yamTrucks.some(t => t.entrepotId !== 2)) {
            console.error("FAIL: Found non-Yamoussoukro trucks in Yamoussoukro query!");
        } else {
            console.log("PASS: Only Yamoussoukro trucks found.");
        }
        
        // 4. Test API Query for No Param
        console.log("\n--- TEST: GET /api/trucks (No ID) ---");
        const respAll = await axios.get('http://localhost:3000/api/trucks');
        const allTestTrucks = respAll.data.filter(t => t.transporteur.startsWith('TEST_'));
        console.log("Total Test Trucks:", allTestTrucks.length);

    } catch (err) {
        console.error("Test Error:", err.message);
        if(err.response) console.error("Response:", err.response.data);
    } finally {
        await db.end();
    }
})();
