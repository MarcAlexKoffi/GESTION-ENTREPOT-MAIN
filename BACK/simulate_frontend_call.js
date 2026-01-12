const axios = require('axios');

(async () => {
    try {
        const warehouseId = 4;
        const url = `http://localhost:3000/api/trucks?entrepotId=${warehouseId}`;
        console.log("Requesting:", url);
        const res = await axios.get(url);
        console.log("Response data:", JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error(err);
    }
})();
