const axios = require('axios');

const fs = require('fs');

async function testNavigation() {
    try {
        console.log("1. Fetching all warehouses (Dashboard)...");
        const listRes = await axios.get('http://localhost:3000/api/warehouses');
        const warehouses = listRes.data;
        console.log(`Found ${warehouses.length} warehouses.`);
        fs.writeFileSync('debug_output.json', JSON.stringify(warehouses, null, 2));
        console.log("Saved response to debug_output.json");

        
        // Find Bouna
        const bouna = warehouses.find(w => w.name.includes('Bouna'));
        if (!bouna) {
            console.error("CRITICAL: 'Entrepos de Bouna' not found in list!");
            return;
        }
        console.log(`Found Bouna in list: ID=${bouna.id}, Name=${bouna.name}`);

        console.log(`2. Fetching details for ID ${bouna.id} (Navigation)...`);
        const detailRes = await axios.get(`http://localhost:3000/api/warehouses/${bouna.id}`);
        const detail = detailRes.data;
        
        console.log("--- Detail Response ---");
        console.log(`ID: ${detail.id}`);
        console.log(`Name: ${detail.name}`);
        console.log(`Location: ${detail.location}`);
        
        if (detail.name !== bouna.name) {
            console.error("FAIL: Name mismatch! Dashboard says 'Bouna' but API detail says '" + detail.name + "'");
        } else {
            console.log("SUCCESS: API returns correct data.");
        }

    } catch (err) {
        console.error("Error:", err.message);
        if (err.response) console.error("Response:", err.response.data);
    }
}

testNavigation();
