const fs = require('fs');
const util = require('util');

const logFile = fs.createWriteStream('inspection_result.txt', { flags: 'w' });
const logStdout = process.stdout;

console.log = function(d) { //
  logFile.write(util.format(d) + '\n');
  logStdout.write(util.format(d) + '\n');
};

const mysql = require('mysql2/promise');

(async () => {
    const db = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestionentrepots',
        port: 3306
    });

    try {
        const [rows] = await db.query("SELECT id, immatriculation, statut, heureArrivee, metadata FROM trucks WHERE statut = 'Enregistré'");
        console.log(`Found ${rows.length} trucks with status 'Enregistré'`);
        
        rows.forEach(r => {
            console.log(`--- Truck ID ${r.id} ---`);
            console.log(`Column heureArrivee: ${r.heureArrivee} (Type: ${typeof r.heureArrivee})`);
            console.log(`Metadata raw: ${r.metadata}`);
            try {
                if (r.metadata) {
                    const meta = JSON.parse(r.metadata);
                    console.log(`Metadata has heureArrivee? ${meta.hasOwnProperty('heureArrivee')}`);
                    if (meta.heureArrivee) {
                        console.log(`Metadata heureArrivee value: "${meta.heureArrivee}"`);
                        const dateFromMeta = new Date(meta.heureArrivee);
                        console.log(`Is metadata heureArrivee valid date? ${!isNaN(dateFromMeta.getTime())}`);
                    }
                }
            } catch (e) {
                console.log('Error parsing metadata');
            }
        });

    } catch (e) {
        console.error(e);
        logFile.write(util.format(e) + '\n');
    } finally {
        await db.end();
        logFile.end();
    }
})();
