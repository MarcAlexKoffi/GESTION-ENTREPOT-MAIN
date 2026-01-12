const axios = require('axios');

(async () => {
    try {
        console.log("--- TESTING API: GET /api/trucks?entrepotId=4 ---");
        const res4 = await axios.get('http://localhost:3000/api/trucks?entrepotId=4');
        console.log("ID 4 Results count:", res4.data.length);
        console.log(JSON.stringify(res4.data, null, 2));

        console.log("\n--- TESTING API: GET /api/trucks?entrepotId=3 ---");
        const res3 = await axios.get('http://localhost:3000/api/trucks?entrepotId=3');
        console.log("ID 3 Results count:", res3.data.length);

        console.log("\n--- TESTING API: GET /api/trucks (No ID) ---");
        const resAll = await axios.get('http://localhost:3000/api/trucks');
        console.log("Total Results count:", resAll.data.length);
        if (resAll.data.length > 0) {
            console.log('First row keys:', Object.keys(resAll.data[0]));
            console.log('First row sample:', JSON.stringify(resAll.data[0], null, 2));
        }

    } catch (err) {
        console.error("API TEST FAILED", err.message);
    }
})();
