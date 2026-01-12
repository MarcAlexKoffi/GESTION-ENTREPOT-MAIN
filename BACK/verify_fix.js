const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestionentrepots'
};

(async () => {
    const db = await mysql.createConnection(dbConfig);
    console.log("Connected to database for verification...");

    try {
        // Create a dummy warehouse and truck to delete
        const [wResult] = await db.query("INSERT INTO warehouses (name, location) VALUES ('Test Warehouse', 'Nowhere')");
        const warehouseId = wResult.insertId;
        console.log(`Created test warehouse ID: ${warehouseId}`);

        const [tResult] = await db.query("INSERT INTO trucks (entrepotId, immatriculation, transporteur) VALUES (?, 'TEST-999', 'Transporter X')", [warehouseId]);
        const truckId = tResult.insertId;
        console.log(`Created test truck ID: ${truckId} attached to warehouse ${warehouseId}`);

        // Add dependent data
        await db.query("INSERT INTO truck_admin_comments (truckId, comment) VALUES (?, 'Test comment')", [truckId]);
        console.log(`Added comment for truck ${truckId}`);

        // Attempt delete
        console.log(`Attempting to delete warehouse ${warehouseId}...`);
        await db.query("DELETE FROM warehouses WHERE id = ?", [warehouseId]);
        
        console.log("SUCCESS: Warehouse deleted without error.");

        // Verify cascading
        const [trucks] = await db.query("SELECT * FROM trucks WHERE id = ?", [truckId]);
        const [comments] = await db.query("SELECT * FROM truck_admin_comments WHERE truckId = ?", [truckId]);

        if (trucks.length === 0 && comments.length === 0) {
            console.log("VERIFIED: Cascading delete worked, all data gone.");
        } else {
            console.error("FAILURE: Data still exists!", { trucks: trucks.length, comments: comments.length });
        }

    } catch (err) {
        console.error("VERIFICATION FAILED:", err);
    } finally {
        await db.end();
    }
})();
