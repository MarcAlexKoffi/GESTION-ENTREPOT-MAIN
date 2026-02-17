const fs = require('fs');
const path = require('path');
const db = require('./db');

async function initializeDatabase() {
  let connection;
  try {
    connection = await db.getConnection();
    
    // 1. Run Layout from db_init.sql
    try {
      const initSqlPath = path.join(__dirname, '../../db_init.sql'); 
      if (fs.existsSync(initSqlPath)) {
        const initSql = fs.readFileSync(initSqlPath, 'utf8');
        const queries = initSql.split(';').filter(q => q.trim());
        console.log('🔄 Running database initialization...');
        for (const query of queries) {
          if (query.trim()) {
             await connection.query(query);
          }
        }
        console.log('✅ Base tables checked/created.');
      } else {
        console.warn('⚠️ db_init.sql not found at ' + initSqlPath);
      }
    } catch (err) {
      console.error('❌ Error executing db_init.sql:', err);
    }

    // 2. Apply Migrations/Patches (Moved from index.js)
    try {
      // Trucks patches
      try { await connection.query("ALTER TABLE trucks ADD COLUMN metadata TEXT NULL"); } catch (e) {}
      try { 
        await connection.query("ALTER TABLE trucks CHANGE plaque immatriculation VARCHAR(255) NOT NULL");
        await connection.query("ALTER TABLE trucks CHANGE chauffeur transporteur VARCHAR(255) NOT NULL");
      } catch (e) {}
      try {
        await connection.query("ALTER TABLE trucks ADD COLUMN transfert VARCHAR(255) NULL");
        await connection.query("ALTER TABLE trucks ADD COLUMN cooperative VARCHAR(255) NULL");
        try {
            await connection.query("UPDATE trucks SET cooperative = coperative WHERE cooperative IS NULL AND coperative IS NOT NULL");
        } catch (e) {}
      } catch (e) {}

      // Empotages patches
        const renameIfExists = async (table, oldCol, newCol, type) => {
        try {
          const [check] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE '${oldCol}'`);
          if (check.length > 0) {
            console.log(`Renaming ${oldCol} to ${newCol} in ${table}...`);
            await connection.query(`ALTER TABLE ${table} CHANGE ${oldCol} ${newCol} ${type}`);
          }
        } catch (e) { }
      };

      await renameIfExists("empotages", "nomClient", "client", "VARCHAR(255) NULL");
      await renameIfExists("empotages", "numeroBooking", "booking", "VARCHAR(255) NULL");
      await renameIfExists("empotages", "nombreConteneurs", "conteneurs", "INT DEFAULT 0");
      await renameIfExists("empotages", "volumeEmpote", "volume", "FLOAT DEFAULT 0");
      await renameIfExists("empotages", "dateDebutEmpotage", "dateStart", "DATETIME NULL");
      await renameIfExists("empotages", "dateFinEmpotage", "dateEnd", "DATETIME NULL");
      
      try { await connection.query("ALTER TABLE empotages ADD COLUMN clientType VARCHAR(255) NULL"); } catch (e) {}
      try { await connection.query("ALTER TABLE empotages ADD COLUMN status VARCHAR(50) DEFAULT 'En attente'"); } catch (e) {}
      try { await connection.query("ALTER TABLE empotages ADD COLUMN entrepotId INT DEFAULT NULL"); } catch (e) {}

      // ID Repairs
      try {
         await connection.query("SET FOREIGN_KEY_CHECKS = 0");
         await connection.query("UPDATE trucks SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM (SELECT id FROM trucks) as t) WHERE id = 0");
         try { await connection.query("ALTER TABLE trucks MODIFY id INT NOT NULL AUTO_INCREMENT"); } catch (e) {}
         
         await connection.query("UPDATE warehouses SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM (SELECT id FROM warehouses) as w) WHERE id = 0");
         try { await connection.query("ALTER TABLE warehouses MODIFY id INT NOT NULL AUTO_INCREMENT"); } catch (e) {}

         await connection.query("UPDATE users SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM (SELECT id FROM users) as u) WHERE id = 0");
         try { await connection.query("ALTER TABLE users MODIFY id INT NOT NULL AUTO_INCREMENT"); } catch (e) {}
         
         await connection.query("SET FOREIGN_KEY_CHECKS = 1");
      } catch (e) {
          console.error("Migration ID repair failed:", e.message);
          await connection.query("SET FOREIGN_KEY_CHECKS = 1");
      }
      
    } catch (migErr) {
      console.error('⚠️ Migration warning:', migErr.message);
    }

    // 3. Seed Admin
    try {
        const [users] = await connection.query("SELECT count(*) as count FROM users");
        if (users[0].count === 0) {
            await connection.query(`
                INSERT INTO users (nom, username, password, role, status)
                VALUES ('Administrateur', 'admin', 'admin123', 'admin', 'Actif')
            `);
            console.log("✅ Admin user created.");
        }
    } catch (seedErr) {
        console.error("❌ Seeding failed:", seedErr.message);
    }

  } catch (err) {
    console.error('❌ Database initialization failed:', err);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = initializeDatabase;
