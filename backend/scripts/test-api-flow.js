const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
const ADMIN_PASSWORD = 'admin123';
const VOTER_AADHAR = '123456789012';

async function testFlow() {
    try {
        const provider = new axios.Axios({ baseURL: BASE_URL }); // Not used for nonce, just a placeholder
        
        console.log("--- Admin Login ---");
        const loginRes = await axios.post(`${BASE_URL}/auth/admin-login`, { password: ADMIN_PASSWORD });
        const adminToken = loginRes.data.token;
        console.log("Admin Token acquired.");

        const config = { headers: { Authorization: `Bearer ${adminToken}` } };

        console.log("\n--- Adding Candidates ---");
        await axios.post(`${BASE_URL}/election/candidates`, { name: "Candidate A" }, config);
        await new Promise(r => setTimeout(r, 2000));
        await axios.post(`${BASE_URL}/election/candidates`, { name: "Candidate B" }, config);
        await new Promise(r => setTimeout(r, 2000));
        console.log("Candidates added.");

        console.log("\n--- Starting Election ---");
        await axios.post(`${BASE_URL}/election/start`, {}, config);
        await new Promise(r => setTimeout(r, 2000));
        console.log("Election started.");

        console.log("\n--- Registering Voter ---");
        await axios.post(`${BASE_URL}/election/voters`, { aadhar_number: VOTER_AADHAR }, config);
        console.log("Voter registered.");

        console.log("\n--- Voter Login ---");
        const voterLoginRes = await axios.post(`${BASE_URL}/auth/verify`, { aadhar_number: VOTER_AADHAR, otp: '123456' });
        const voterToken = voterLoginRes.data.token;
        console.log("Voter Token acquired.");

        const voterConfig = { headers: { Authorization: `Bearer ${voterToken}` } };

        console.log("\n--- Casting Vote ---");
        const voteRes = await axios.post(`${BASE_URL}/election/vote`, { candidateId: 0 }, voterConfig);
        console.log("Vote cast! Transaction hash:", voteRes.data.txHash);

        console.log("\n--- Verifying Audit Log ---");
        const auditRes = await axios.get(`${BASE_URL}/election/audit`, voterConfig);
        console.log("Audit Log count:", auditRes.data.length);
        console.log("Latest transaction hash:", auditRes.data[0].transactionHash);

        console.log("\n--- End-to-End Test Successful ---");
    } catch (error) {
        console.error("Test failed:", error.response?.data || error.message);
    }
}

testFlow();
