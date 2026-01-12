const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestionentrepots'
};

(async () => {
    const db = await mysql.createConnection(dbConfig);
    console.log("Connected to database for cascading delete fix...");

    try {
        await db.query("SET FOREIGN_KEY_CHECKS = 0");

        // 1. Fix truck_admin_comments
        console.log("Fixing truck_admin_comments...");
        try {
            await db.query("ALTER TABLE truck_admin_comments DROP FOREIGN KEY fk_comment_truck");
        } catch (e) { console.log("FK fk_comment_truck likely didn't exist or error:", e.message); }
        
        // Unify type to match trucks.id (INT(11))
        await db.query("ALTER TABLE truck_admin_comments MODIFY truckId INT(11) NOT NULL");
        
        // Re-add constraint
        await db.query("ALTER TABLE truck_admin_comments ADD CONSTRAINT fk_comment_truck FOREIGN KEY (truckId) REFERENCES trucks(id) ON DELETE CASCADE");
        console.log("truck_admin_comments fixed.");


        // 2. Fix truck_history
        console.log("Fixing truck_history...");
        try {
            await db.query("ALTER TABLE truck_history DROP FOREIGN KEY fk_history_truck");
        } catch (e) { console.log("FK fk_history_truck likely didn't exist or error:", e.message); }

        await db.query("ALTER TABLE truck_history MODIFY truckId INT(11) NOT NULL");
        
        await db.query("ALTER TABLE truck_history ADD CONSTRAINT fk_history_truck FOREIGN KEY (truckId) REFERENCES trucks(id) ON DELETE CASCADE");
        console.log("truck_history fixed.");


        // 3. Fix truck_products
        console.log("Fixing truck_products...");
        try {
            await db.query("ALTER TABLE truck_products DROP FOREIGN KEY fk_products_truck");
        } catch (e) { console.log("FK fk_products_truck likely didn't exist or error:", e.message); }

        await db.query("ALTER TABLE truck_products MODIFY truckId INT(11) NOT NULL");

        await db.query("ALTER TABLE truck_products ADD CONSTRAINT fk_products_truck FOREIGN KEY (truckId) REFERENCES trucks(id) ON DELETE CASCADE");
        console.log("truck_products fixed.");
        
        console.log("ALL FIXES APPLIED SUCCESSFULLY.");

    } catch (err) {
        console.error("CRITICAL ERROR during fix:", err);
    } finally {
        await db.query("SET FOREIGN_KEY_CHECKS = 1");
        await db.end();
    }
})();
