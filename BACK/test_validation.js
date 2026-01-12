const axios = require('axios');

(async () => {
    console.log("--- TEST: Truck Creation Validation ---");

    // 1. Valid Creation
    try {
        console.log("Attempting Valid Creation (ID 1)...");
        const res = await axios.post('http://localhost:3000/api/trucks', {
            entrepotId: 1,
            immatriculation: 'VALID-01',
            transporteur: 'TEST_VALIDATION'
        });
        console.log("SUCCESS: Created Truck ID", res.data.id);
    } catch (e) {
        console.error("FAIL: Valid creation failed", e.response?.data || e.message);
    }

    // 2. Invalid Creation (Non-existent Entrepot)
    try {
        console.log("Attempting Invalid Creation (ID 99999)...");
        await axios.post('http://localhost:3000/api/trucks', {
            entrepotId: 99999,
            immatriculation: 'INVALID-01',
            transporteur: 'TEST_VALIDATION'
        });
        console.error("FAIL: Invalid creation should have failed but succeeded!");
    } catch (e) {
        if (e.response && e.response.status === 400) {
           console.log("PASS: Blocked with 400 Bad Request:", e.response.data.message);
        } else if (e.response) {
           console.error("FAIL: Unexpected error status:", e.response.status);
           console.error("Response Body:", e.response.data);
        } else {
           console.error("FAIL: Network/Client error", e.message);
        }
    }
})();
