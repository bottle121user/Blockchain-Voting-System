const http = require('http');

console.log("==> Please ensure the Express server is running on port 5000.");
console.log("==> You can run the server via `npm start`.\n");

function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        
        req.on('error', (e) => reject(e));
        
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

async function runTests() {
    console.log("--- Starting API Flow Test ---\n");

    // 1. Authenticate (Mock Aadhar)
    console.log("[1] Testing /api/auth/verify...");
    const authRes = await makeRequest({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/auth/verify',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { aadhar_number: "123412341234", otp: "123456" });
    
    console.log("Status:", authRes.status);
    console.log("Response:", authRes.body);

    if (authRes.status !== 200 || !authRes.body.token) {
        console.error("Test failed at Authentication step. (Is your server running?)");
        return;
    }
    const token = authRes.body.token;

    // 2. Fetch Candidates
    console.log("\n[2] Testing /api/election/candidates...");
    const candRes = await makeRequest({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/election/candidates',
        method: 'GET'
    });
    console.log("Status:", candRes.status);
    console.log("Response:", candRes.body);

    // 3. Cast Vote
    // We assume candidate ID 0 exists for this test.
    console.log("\n[3] Testing /api/election/vote...");
    const voteRes = await makeRequest({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/election/vote',
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    }, { candidateId: 0 });
    
    console.log("Status:", voteRes.status);
    console.log("Response:", voteRes.body);

    // 4. Double Vote Prevention
    console.log("\n[4] Testing /api/election/vote (Double Voting Prevention)...");
    const testRes = await makeRequest({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/election/vote',
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    }, { candidateId: 0 });
    
    console.log("Status:", testRes.status);
    console.log("Response:", testRes.body);

    console.log("\n--- API Flow Test Complete ---");
}

runTests().catch(console.error);
