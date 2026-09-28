const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runFullSystemTest() {
    console.log('================================================================');
    console.log('   ChainVote — Comprehensive End-to-End System Test Suite       ');
    console.log('================================================================\n');

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, testName) {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passedTests++;
        } else {
            console.error(`[FAIL] ${testName}`);
            failedTests++;
        }
    }

    try {
        // Test 1: System Health Telemetry
        const healthRes = await axios.get('http://localhost:5000/health');
        assert(healthRes.data.status === 'HEALTHY' && healthRes.data.blockchain.connected === true, '1. System Health Telemetry is HEALTHY with EVM connected');

        // Test 2: Admin Bcrypt Authentication
        const adminLogin = await axios.post(`${BASE_URL}/auth/admin-login`, { username: 'admin', password: 'admin123' });
        const adminToken = adminLogin.data.token;
        assert(!!adminToken && adminLogin.data.role === 'ADMIN', '2. Admin Authentication (Bcrypt verified, role=ADMIN)');

        const adminConfig = { headers: { Authorization: `Bearer ${adminToken}` } };

        // Test 3: Create a New Election Session on Blockchain
        const createElectionRes = await axios.post(
            `${BASE_URL}/elections`, 
            { name: `Civic Council 2026 #${Date.now()}`, description: 'Live municipal integrity ballot' }, 
            adminConfig
        );
        assert(!!createElectionRes.data.txHash, `3. Multi-Election Created on Blockchain (Tx: ${createElectionRes.data.txHash.substring(0, 16)}...)`);

        const electionId = createElectionRes.data.electionId;
        assert(electionId > 0, `4. Election #${electionId} initialized in CREATED state`);

        // Test 5: Register Candidates
        await axios.post(`${BASE_URL}/elections/${electionId}/candidates`, { name: 'Dr. Jane Doe' }, adminConfig);
        await axios.post(`${BASE_URL}/elections/${electionId}/candidates`, { name: 'Prof. John Smith' }, adminConfig);
        
        const candRes = await axios.get(`${BASE_URL}/elections/${electionId}/candidates`);
        assert(candRes.data.length === 2, `5. Registered 2 Candidates on-chain for Election #${electionId}`);

        // Test 6: Open Election Window
        const openRes = await axios.post(`${BASE_URL}/elections/${electionId}/open`, {}, adminConfig);
        assert(!!openRes.data.txHash, `6. Transitioned Election #${electionId} to OPEN state (Tx: ${openRes.data.txHash.substring(0, 16)}...)`);

        // Test 7: Authorize Citizen with Cryptographic Nullifier Commitment
        const testVoterId = `8888${Math.floor(10000000 + Math.random() * 90000000)}`;
        const regRes = await axios.post(`${BASE_URL}/elections/${electionId}/voters`, { aadhar_number: testVoterId }, adminConfig);
        assert(!!regRes.data.nullifier, `7. Citizen whitelisted with Nullifier: ${regRes.data.nullifier.substring(0, 16)}...`);

        // Test 8: Citizen Authentication
        const voterLogin = await axios.post(`${BASE_URL}/auth/verify`, { aadhar_number: testVoterId, otp: '123456' });
        const voterToken = voterLogin.data.token;
        assert(!!voterToken && !!voterLogin.data.hashedAadhar, '8. Citizen Authenticated via National ID Protocol');

        const voterConfig = { headers: { Authorization: `Bearer ${voterToken}` } };

        // Test 9: Cast Legitimate Ballot
        const voteRes = await axios.post(`${BASE_URL}/elections/${electionId}/vote`, { candidateId: 0 }, voterConfig);
        assert(
            !!voteRes.data.txHash && !!voteRes.data.blockNumber,
            `9. Ballot Cast & Confirmed on Ledger (Block #${voteRes.data.blockNumber}, Tx: ${voteRes.data.txHash.substring(0, 16)}...)`
        );
        const castTxHash = voteRes.data.txHash;
        const castNullifier = voteRes.data.nullifier;

        // Test 10: Double-Voting Rejection Check
        let doubleVoteRejected = false;
        try {
            await axios.post(`${BASE_URL}/elections/${electionId}/vote`, { candidateId: 1 }, voterConfig);
        } catch (err) {
            if (err.response && err.response.status === 403) {
                doubleVoteRejected = true;
            }
        }
        assert(doubleVoteRejected, '10. Double-Voting Strictly Rejected by Cryptographic Nullifier');

        // Test 11: Admin Forbidden from Voting Check
        let adminVoteRejected = false;
        try {
            await axios.post(`${BASE_URL}/elections/${electionId}/vote`, { candidateId: 0 }, adminConfig);
        } catch (err) {
            if (err.response && err.response.status === 403) {
                adminVoteRejected = true;
            }
        }
        assert(adminVoteRejected, '11. Admin Forbidden from Casting Ballots (Role-Based Access Control)');

        // Test 12: On-Chain Tally Verification
        const updatedCandRes = await axios.get(`${BASE_URL}/elections/${electionId}/candidates`);
        const cand0Votes = Number(updatedCandRes.data[0].voteCount);
        assert(cand0Votes === 1, `12. On-Chain Tally Verified (Dr. Jane Doe has exactly 1 confirmed vote)`);

        // Test 13: Event Indexer Verification
        let auditEvents = [];
        for (let attempt = 0; attempt < 8; attempt++) {
            try { await axios.post(`${BASE_URL}/audit/sync`); } catch (_) {}
            await new Promise(r => setTimeout(r, 1000));
            const auditRes = await axios.get(`${BASE_URL}/elections/${electionId}/audit`);
            auditEvents = auditRes.data;
            if (auditEvents.length >= 4 && auditEvents.some(e => e.transactionHash === castTxHash || e.nullifier === castNullifier)) {
                break;
            }
        }
        assert(Array.isArray(auditEvents) && auditEvents.length >= 4, `13. Public Audit Trail retrieved (${auditEvents.length} events indexed)`);

        // Test 14: Public Ballot Verifier Simulation
        const matchedAudit = auditEvents.find(e => e.transactionHash === castTxHash || e.nullifier === castNullifier);
        assert(
            !!matchedAudit && matchedAudit.eventName === 'VoteCast',
            `14. Public Ballot Verifier Match: Proved Tx ${castTxHash.substring(0, 16)}... in Block #${matchedAudit?.blockNumber}`
        );

        // Test 15: Emergency Annulment Protocol
        const annulRes = await axios.post(`${BASE_URL}/elections/${electionId}/annul`, { reason: 'Credential compromise simulation in cohort C' }, adminConfig);
        assert(!!annulRes.data.txHash, `15. Emergency Annulment Executed on-chain (Tx: ${annulRes.data.txHash.substring(0, 16)}...)`);

        // Test 16: Linked Re-Election Protocol
        const reElectRes = await axios.post(`${BASE_URL}/elections/${electionId}/re-elect`, { reason: 'Credential rotation and replacement completed' }, adminConfig);
        const newElectionId = reElectRes.data.newElectionId;
        assert(newElectionId > electionId && reElectRes.data.parentElectionId === electionId, `16. Linked Re-Election #${newElectionId} Spawned (Parent: #${electionId})`);

        // Test 17: Statutory Candidate Nomination & Eligibility Vetting
        const candVoterId = `7777${Math.floor(10000000 + Math.random() * 90000000)}`.substring(0, 12);
        const sec1VoterId = `8888${Math.floor(10000000 + Math.random() * 90000000)}`.substring(0, 12);
        const sec2VoterId = `9999${Math.floor(10000000 + Math.random() * 90000000)}`.substring(0, 12);
        
        // Whitelist candidate and seconders as registered voters
        await axios.post(`${BASE_URL}/elections/${newElectionId}/voters`, { aadhar_number: candVoterId }, adminConfig);
        await axios.post(`${BASE_URL}/elections/${newElectionId}/voters`, { aadhar_number: sec1VoterId }, adminConfig);
        await axios.post(`${BASE_URL}/elections/${newElectionId}/voters`, { aadhar_number: sec2VoterId }, adminConfig);

        // Sub-check: Reject under-age candidate
        let underAgeRejected = false;
        try {
            await axios.post(`${BASE_URL}/elections/${newElectionId}/nominate`, {
                aadhar_number: candVoterId,
                full_name: 'Minor Applicant',
                party_affiliation: 'YOUTH',
                age: 17,
                manifesto: 'Too young to run according to statutory law.',
                seconder1_id: sec1VoterId,
                seconder2_id: sec2VoterId,
                code_of_conduct_accepted: true
            });
        } catch (err) {
            if (err.response && err.response.status === 400) underAgeRejected = true;
        }

        // Legitimate submission
        const nomRes = await axios.post(`${BASE_URL}/elections/${newElectionId}/nominate`, {
            aadhar_number: candVoterId,
            full_name: 'Senator Alice Walker',
            party_affiliation: 'Progressive Alliance',
            age: 34,
            manifesto: 'Universal digital democracy, transparent governance, and cryptographically verified public accountability.',
            seconder1_id: sec1VoterId,
            seconder2_id: sec2VoterId,
            code_of_conduct_accepted: true
        });

        assert(
            underAgeRejected && nomRes.data.status === 'PENDING',
            '17. Candidate Nomination submitted with statutory vetting (underage rejected, valid nomination queued as PENDING)'
        );

        // Test 18: Admin Review Queue & Blockchain Minting
        const queueRes = await axios.get(`${BASE_URL}/elections/${newElectionId}/nominations`);
        const targetNom = queueRes.data.find(n => n.full_name === 'Senator Alice Walker');
        assert(!!targetNom, '18a. Nomination visible in Admin Review Queue');

        const approveRes = await axios.post(`${BASE_URL}/elections/${newElectionId}/nominations/${targetNom.id}/approve`, {}, adminConfig);
        assert(!!approveRes.data.txHash, `18b. Nomination approved and minted to Blockchain (Tx: ${approveRes.data.txHash.substring(0, 16)}...)`);

        const newCandList = await axios.get(`${BASE_URL}/elections/${newElectionId}/candidates`);
        const mintedCand = newCandList.data.find(c => c.name === 'Senator Alice Walker');
        assert(!!mintedCand, `18c. Candidate verified on smart contract ledger (Index: ${mintedCand?.id ?? mintedCand?.candidate_index})`);

        console.log('\n----------------------------------------------------------------');
        console.log(`Test Execution Completed: ${passedTests} PASSED, ${failedTests} FAILED`);
        console.log('----------------------------------------------------------------\n');

        if (failedTests > 0) {
            process.exit(1);
        }
    } catch (err) {
        console.error('\n[FATAL] Unexpected error during test run:', err.response?.data || err.message);
        process.exit(1);
    }
}

runFullSystemTest();
