const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');

const db = require('../database/db');
const { contract, provider, wallet } = require('./blockchain');
const nonceManager = require('../services/nonceManager');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_in_production';

// Rate Limiter for Authentication and Vote Endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});

const voteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Rate limit exceeded for voting. Please wait.' }
});

// Helper: Compute cryptographic nullifier hash (commitment)
function generateNullifier(voterIdentifier, electionId) {
    return '0x' + crypto.createHash('sha256').update(`${voterIdentifier}:${electionId}`).digest('hex');
}

// Middleware: Authenticate JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Failed to authenticate token or token expired' });
        req.user = decoded;
        next();
    });
};

// Middleware: Admin Only Access
const adminOnly = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role !== 'ADMIN' && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: Administrator privileges required' });
        }
        next();
    });
};

// Helper: Get active or latest election ID
async function getLatestElectionId() {
    const res = await db.query('SELECT id FROM elections ORDER BY id DESC LIMIT 1');
    if (res.rows.length > 0) return res.rows[0].id;

    if (contract) {
        try {
            const count = await contract.electionCounter();
            if (Number(count) > 0) return Number(count);
        } catch (_) {}
    }
    return 1;
}

// -----------------------------------------------------------------------------
// CORE BUSINESS LOGIC HANDLERS
// -----------------------------------------------------------------------------

async function executeVote(electionId, candidateId, voterHash, isAdmin, res) {
    if (!voterHash) {
        return res.status(403).json({ error: 'Voter cryptographic identifier missing from token' });
    }
    if (isAdmin) {
        return res.status(403).json({ error: 'Administrators are strictly prohibited from casting ballots' });
    }

    try {
        // 1. Verify eligibility in database
        const authCheck = await db.query(
            'SELECT * FROM voter_authorizations WHERE election_id = $1 AND voter_identifier_hash = $2',
            [electionId, voterHash]
        );

        let voterRecord = authCheck.rows[0];
        let nullifier;

        if (!voterRecord) {
            // Auto-whitelist verified demo voter
            nullifier = generateNullifier(voterHash, electionId);
            await db.query(
                `INSERT INTO voter_authorizations (election_id, voter_identifier_hash, nullifier_hash, has_voted)
                 VALUES ($1, $2, $3, 0)`,
                [electionId, voterHash, nullifier]
            );
        } else {
            if (voterRecord.has_voted) {
                return res.status(403).json({ error: 'Integrity Violation: You have already cast your ballot in this election.' });
            }
            nullifier = voterRecord.nullifier_hash;
        }

        // 2. Pre-check on-chain nullifier
        const isSpentOnChain = await contract.hasVotedNullifier(electionId, nullifier);
        if (isSpentOnChain) {
            await db.query(
                'UPDATE voter_authorizations SET has_voted = 1 WHERE election_id = $1 AND nullifier_hash = $2',
                [electionId, nullifier]
            );
            return res.status(403).json({ error: 'Double vote rejected: Nullifier hash already spent on-chain.' });
        }

        // 3. Execute relayed transaction via serialized NonceManager
        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.castVoteRelayed(electionId, candidateId, nullifier, { nonce });
        });

        // 4. Record transaction in database
        await db.query(
            'INSERT INTO transactions (election_id, tx_hash, tx_type, status) VALUES ($1, $2, $3, $4)',
            [electionId, tx.hash, 'CAST_VOTE', 'SUBMITTED']
        );

        // Optimistically mark voter as voted off-chain
        await db.query(
            'UPDATE voter_authorizations SET has_voted = 1, voted_at = CURRENT_TIMESTAMP WHERE election_id = $1 AND voter_identifier_hash = $2',
            [electionId, voterHash]
        );

        // Await confirmation
        const receipt = await tx.wait();

        res.json({
            message: 'Ballot successfully recorded and verified on the blockchain',
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            nullifier: nullifier
        });
    } catch (err) {
        console.error('Vote casting error:', err);
        res.status(500).json({ error: 'Blockchain transaction failed during vote casting', details: err.message });
    }
}

async function getAuditLog(electionId, res) {
    try {
        const result = await db.query(
            `SELECT * FROM blockchain_events 
             WHERE election_id = $1 
             ORDER BY block_number DESC, log_index DESC`,
            [electionId]
        );

        const formatted = result.rows.map(row => {
            let payload = {};
            try {
                payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json;
            } catch (_) {}

            return {
                eventName: row.event_name,
                blockNumber: Number(row.block_number),
                transactionHash: row.tx_hash,
                logIndex: row.log_index,
                indexedAt: row.indexed_at,
                candidateId: payload.candidateId,
                voterAddress: payload.submitter,
                nullifier: payload.nullifier
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching audit log:', err);
        res.status(500).json({ error: 'Failed to retrieve indexed audit trail' });
    }
}

async function addCandidateHandler(electionId, name, res) {
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Candidate name is required' });
    }

    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });

        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.addCandidate(electionId, name.trim(), { nonce });
        });

        await db.query(
            'INSERT INTO transactions (election_id, tx_hash, tx_type, status) VALUES ($1, $2, $3, $4)',
            [electionId, tx.hash, 'ADD_CANDIDATE', 'SUBMITTED']
        );

        await tx.wait();
        res.json({ message: 'Candidate added successfully', txHash: tx.hash });
    } catch (err) {
        console.error('Add candidate error:', err);
        res.status(500).json({ error: 'Failed to add candidate', details: err.message });
    }
}

// -----------------------------------------------------------------------------
// 1. AUTHENTICATION ENDPOINTS
// -----------------------------------------------------------------------------

router.post('/auth/admin-login', authLimiter, async (req, res) => {
    const schema = z.object({
        username: z.string().optional().default('admin'),
        password: z.string().min(1, 'Password is required')
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { username, password } = parsed.data;

    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid administrator credentials' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch && password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid administrator credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, isAdmin: true },
            JWT_SECRET,
            { expiresIn: '4h' }
        );

        await db.query('INSERT INTO audit_logs (actor, action, details_json) VALUES ($1, $2, $3)', [
            username,
            'ADMIN_LOGIN_SUCCESS',
            JSON.stringify({ ip: req.ip })
        ]);

        res.json({ token, role: user.role, message: 'Admin authentication successful' });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
});

router.post('/auth/verify', authLimiter, async (req, res) => {
    const schema = z.object({
        aadhar_number: z.string().min(12).max(12, 'National ID must be exactly 12 digits'),
        otp: z.string().min(6).max(6, 'Verification code must be 6 digits')
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { aadhar_number, otp } = parsed.data;

    if (otp !== '123456') {
        return res.status(401).json({ error: 'Invalid verification token (Demo code: 123456)' });
    }

    const hashedAadhar = crypto.createHash('sha256').update(aadhar_number).digest('hex');
    const token = jwt.sign(
        { hashedAadhar, role: 'VOTER', isAdmin: false },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    res.json({ 
        token, 
        hashedAadhar,
        message: 'Identity verified successfully under National ID Demo Protocol' 
    });
});

// -----------------------------------------------------------------------------
// 2. MULTI-ELECTION LIFECYCLE ENDPOINTS
// -----------------------------------------------------------------------------

router.get('/elections', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT e.*, COUNT(c.id) as candidates_count
            FROM elections e
            LEFT JOIN candidates c ON e.id = c.election_id
            GROUP BY e.id
            ORDER BY e.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching elections:', err);
        res.status(500).json({ error: 'Failed to fetch elections' });
    }
});

router.post('/elections', adminOnly, async (req, res) => {
    const schema = z.object({
        name: z.string().min(3, 'Election name must be at least 3 characters'),
        description: z.string().optional().default('General Election Session')
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { name, description } = parsed.data;

    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain relayer not initialized' });

        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.createElection(name, description, { nonce });
        });

        await db.query(
            'INSERT INTO transactions (tx_hash, tx_type, status) VALUES ($1, $2, $3)',
            [tx.hash, 'CREATE_ELECTION', 'SUBMITTED']
        );

        const receipt = await tx.wait();
        const newId = Number(await contract.electionCounter());
        const contractAddress = await contract.getAddress();

        await db.query(
            `INSERT OR IGNORE INTO elections (id, name, description, state, contract_address, creation_tx_hash)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [newId, name, description, 'CREATED', contractAddress, tx.hash]
        );

        res.json({ 
            message: 'Election created successfully on blockchain', 
            electionId: newId,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber 
        });
    } catch (err) {
        console.error('Create election error:', err);
        res.status(500).json({ error: 'Failed to create election on blockchain', details: err.message });
    }
});

router.get('/elections/:id/candidates', async (req, res) => {
    const electionId = Number(req.params.id);
    if (isNaN(electionId)) return res.status(400).json({ error: 'Invalid election ID' });

    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });

        const onChainCandidates = await contract.getCandidates(electionId);
        const formatted = onChainCandidates.map(c => ({
            id: c.id.toString(),
            name: c.name,
            voteCount: c.voteCount.toString()
        }));
        res.json(formatted);
    } catch (err) {
        console.error('Error fetching candidates:', err);
        res.status(500).json({ error: 'Failed to fetch election candidates' });
    }
});

router.post('/elections/:id/candidates', adminOnly, async (req, res) => {
    const electionId = Number(req.params.id);
    return addCandidateHandler(electionId, req.body.name, res);
});

router.post('/elections/:id/open', adminOnly, async (req, res) => {
    const electionId = Number(req.params.id);

    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });

        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.openElection(electionId, { nonce });
        });

        await db.query(
            'INSERT INTO transactions (election_id, tx_hash, tx_type, status) VALUES ($1, $2, $3, $4)',
            [electionId, tx.hash, 'OPEN_ELECTION', 'SUBMITTED']
        );

        await tx.wait();
        res.json({ message: 'Election opened successfully', txHash: tx.hash });
    } catch (err) {
        console.error('Open election error:', err);
        res.status(500).json({ error: 'Failed to open election', details: err.message });
    }
});

router.post('/elections/:id/close', adminOnly, async (req, res) => {
    const electionId = Number(req.params.id);

    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });

        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.closeElection(electionId, { nonce });
        });

        await db.query(
            'INSERT INTO transactions (election_id, tx_hash, tx_type, status) VALUES ($1, $2, $3, $4)',
            [electionId, tx.hash, 'CLOSE_ELECTION', 'SUBMITTED']
        );

        await tx.wait();
        res.json({ message: 'Election closed successfully', txHash: tx.hash });
    } catch (err) {
        console.error('Close election error:', err);
        res.status(500).json({ error: 'Failed to close election', details: err.message });
    }
});

router.post('/elections/:id/finalize', adminOnly, async (req, res) => {
    const electionId = Number(req.params.id);

    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });

        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.finalizeElection(electionId, { nonce });
        });

        await db.query(
            'INSERT INTO transactions (election_id, tx_hash, tx_type, status) VALUES ($1, $2, $3, $4)',
            [electionId, tx.hash, 'FINALIZE_ELECTION', 'SUBMITTED']
        );

        await tx.wait();
        res.json({ message: 'Election finalized successfully', txHash: tx.hash });
    } catch (err) {
        console.error('Finalize election error:', err);
        res.status(500).json({ error: 'Failed to finalize election', details: err.message });
    }
});

router.post('/elections/:id/annul', adminOnly, async (req, res) => {
    const electionId = Number(req.params.id);
    if (isNaN(electionId)) return res.status(400).json({ error: 'Invalid election ID' });

    const schema = z.object({
        reason: z.string().min(5, 'Annulment reason must be at least 5 characters')
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { reason } = parsed.data;

    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });

        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.annulElection(electionId, reason, { nonce });
        });

        await db.query(
            'INSERT INTO transactions (election_id, tx_hash, tx_type, status) VALUES ($1, $2, $3, $4)',
            [electionId, tx.hash, 'ANNUL_ELECTION', 'SUBMITTED']
        );

        const receipt = await tx.wait();

        await db.query(
            `UPDATE elections 
             SET state = 'ANNULLED', annulment_reason = $1, closed_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [reason, electionId]
        );

        await db.query(
            `INSERT INTO audit_logs (actor, action, details_json)
             VALUES ($1, $2, $3)`,
            [
                req.user?.username || 'ADMIN',
                'ELECTION_ANNULLED_EMERGENCY',
                JSON.stringify({ electionId, reason, txHash: tx.hash, blockNumber: receipt.blockNumber })
            ]
        );

        res.json({
            message: 'Election emergency annulment executed successfully',
            electionId,
            reason,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        });
    } catch (err) {
        console.error('Annul election error:', err);
        res.status(500).json({ error: 'Failed to annul election', details: err.message });
    }
});

router.post('/elections/:id/re-elect', adminOnly, async (req, res) => {
    const electionId = Number(req.params.id);
    if (isNaN(electionId)) return res.status(400).json({ error: 'Invalid election ID' });

    const schema = z.object({
        reason: z.string().min(5, 'Re-election justification must be at least 5 characters')
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { reason } = parsed.data;

    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });

        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.createReElection(electionId, reason, { nonce });
        });

        await db.query(
            'INSERT INTO transactions (election_id, tx_hash, tx_type, status) VALUES ($1, $2, $3, $4)',
            [electionId, tx.hash, 'RE_ELECTION_CREATED', 'SUBMITTED']
        );

        const receipt = await tx.wait();
        const newId = Number(await contract.electionCounter());
        const contractAddress = await contract.getAddress();
        const newElection = await contract.getElection(newId);

        await db.query(
            `INSERT OR IGNORE INTO elections (id, name, description, state, contract_address, creation_tx_hash, parent_election_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newId, newElection.name, newElection.description, 'CREATED', contractAddress, tx.hash, electionId]
        );

        // Populate cloned candidates in DB
        const candidates = await contract.getCandidates(newId);
        for (const cand of candidates) {
            await db.query(
                `INSERT OR IGNORE INTO candidates (election_id, candidate_index, name)
                 VALUES ($1, $2, $3)`,
                [newId, Number(cand.id), cand.name]
            );
        }

        await db.query(
            `INSERT INTO audit_logs (actor, action, details_json)
             VALUES ($1, $2, $3)`,
            [
                req.user?.username || 'ADMIN',
                'RE_ELECTION_SPAWNED',
                JSON.stringify({ parentElectionId: electionId, newElectionId: newId, reason, txHash: tx.hash, blockNumber: receipt.blockNumber })
            ]
        );

        res.json({
            message: 'Linked re-election session deployed successfully',
            parentElectionId: electionId,
            newElectionId: newId,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        });
    } catch (err) {
        console.error('Re-election error:', err);
        res.status(500).json({ error: 'Failed to deploy re-election', details: err.message });
    }
});

router.post('/elections/:id/voters', adminOnly, async (req, res) => {
    const electionId = Number(req.params.id);
    const schema = z.object({
        aadhar_number: z.string().min(12).max(12, 'National ID must be 12 digits')
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { aadhar_number } = parsed.data;
    const voterHash = crypto.createHash('sha256').update(aadhar_number).digest('hex');
    const nullifier = generateNullifier(voterHash, electionId);

    try {
        await db.query(
            `INSERT INTO voter_authorizations (election_id, voter_identifier_hash, nullifier_hash, has_voted)
             VALUES ($1, $2, $3, 0)`,
            [electionId, voterHash, nullifier]
        );

        res.json({ 
            message: 'Voter authorized with cryptographic nullifier commitment', 
            voterHash, 
            nullifier 
        });
    } catch (err) {
        console.error('Voter authorization error:', err);
        res.status(500).json({ error: 'Failed to authorize voter in registry' });
    }
});

router.post('/elections/:id/vote', verifyToken, voteLimiter, async (req, res) => {
    const electionId = Number(req.params.id);
    const schema = z.object({
        candidateId: z.coerce.number().int().nonnegative('Candidate ID must be a non-negative integer')
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { candidateId } = parsed.data;
    const voterHash = req.user.hashedAadhar;
    const isAdmin = req.user.isAdmin;

    return executeVote(electionId, candidateId, voterHash, isAdmin, res);
});

router.get('/elections/:id/audit', async (req, res) => {
    const electionId = Number(req.params.id);
    return getAuditLog(electionId, res);
});

router.get('/elections/:id/voters', adminOnly, async (req, res) => {
    const electionId = Number(req.params.id);
    try {
        const result = await db.query(
            'SELECT voter_identifier_hash, has_voted, voted_at, created_at FROM voter_authorizations WHERE election_id = $1',
            [electionId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching voters:', err);
        res.status(500).json({ error: 'Failed to retrieve voter registry' });
    }
});

// -----------------------------------------------------------------------------
// 3. BACKWARD-COMPATIBILITY ROUTES
// -----------------------------------------------------------------------------

router.get('/election/state', async (req, res) => {
    try {
        const electionId = await getLatestElectionId();
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });

        const election = await contract.getElection(electionId);
        let legacyState = 0;
        const s = Number(election.state);
        if (s === 2) legacyState = 1;
        else if (s >= 3) legacyState = 2;

        res.json({ 
            state: legacyState, 
            onChainState: s, 
            electionId,
            name: election.name,
            annulmentReason: election.annulmentReason || null,
            parentElectionId: Number(election.parentElectionId) || 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch election state' });
    }
});

router.get('/election/candidates', async (req, res) => {
    try {
        const electionId = await getLatestElectionId();
        const onChainCandidates = await contract.getCandidates(electionId);
        const formatted = onChainCandidates.map(c => ({
            id: c.id.toString(),
            name: c.name,
            voteCount: c.voteCount.toString()
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch candidates' });
    }
});

router.post('/election/candidates', adminOnly, async (req, res) => {
    const electionId = await getLatestElectionId();
    return addCandidateHandler(electionId, req.body.name, res);
});

router.post('/election/start', adminOnly, async (req, res) => {
    const electionId = await getLatestElectionId();
    try {
        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.openElection(electionId, { nonce });
        });
        await tx.wait();
        res.json({ message: 'Election started successfully', txHash: tx.hash });
    } catch (err) {
        res.status(500).json({ error: 'Failed to start election', details: err.message });
    }
});

router.post('/election/end', adminOnly, async (req, res) => {
    const electionId = await getLatestElectionId();
    try {
        const tx = await nonceManager.enqueue(async (nonce) => {
            return await contract.closeElection(electionId, { nonce });
        });
        await tx.wait();
        res.json({ message: 'Election ended successfully', txHash: tx.hash });
    } catch (err) {
        res.status(500).json({ error: 'Failed to end election', details: err.message });
    }
});

router.post('/election/voters', adminOnly, async (req, res) => {
    const electionId = await getLatestElectionId();
    const { aadhar_number } = req.body;
    if (!aadhar_number) return res.status(400).json({ error: 'National ID number is required' });

    const voterHash = crypto.createHash('sha256').update(aadhar_number).digest('hex');
    const nullifier = generateNullifier(voterHash, electionId);

    try {
        await db.query(
            `INSERT INTO voter_authorizations (election_id, voter_identifier_hash, nullifier_hash, has_voted)
             VALUES ($1, $2, $3, 0)`,
            [electionId, voterHash, nullifier]
        );

        res.json({ message: 'Voter registered successfully', hashedAadhar: voterHash, nullifier });
    } catch (err) {
        res.status(500).json({ error: 'Failed to record voter authorization' });
    }
});

router.post('/election/vote', verifyToken, async (req, res) => {
    const electionId = await getLatestElectionId();
    const candidateId = req.body.candidateId;
    const voterHash = req.user.hashedAadhar;
    const isAdmin = req.user.isAdmin;

    return executeVote(electionId, candidateId, voterHash, isAdmin, res);
});

router.get('/election/audit', async (req, res) => {
    const electionId = await getLatestElectionId();
    return getAuditLog(electionId, res);
});

router.get('/election/voters', adminOnly, async (req, res) => {
    const electionId = await getLatestElectionId();
    try {
        const result = await db.query(
            'SELECT voter_identifier_hash as hashed_aadhar, has_voted FROM voter_authorizations WHERE election_id = $1',
            [electionId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve voter registry' });
    }
});

module.exports = router;
