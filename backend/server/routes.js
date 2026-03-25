const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');
const { contract, wallet } = require('./blockchain');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_in_production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// MOCK AADHAR VERIFICATION (VOTERS)
router.post('/auth/verify', (req, res) => {
    const { aadhar_number, otp } = req.body;

    if (!aadhar_number || !otp) {
        return res.status(400).json({ error: 'Aadhar number and OTP are required' });
    }

    if (otp !== '123456') {
        return res.status(401).json({ error: 'Invalid OTP' });
    }

    const hashedAadhar = crypto.createHash('sha256').update(aadhar_number).digest('hex');
    const token = jwt.sign({ hashedAadhar, isAdmin: false }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, message: 'Authentication successful' });
});

// ADMIN LOGIN
router.post('/auth/admin-login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ isAdmin: true }, JWT_SECRET, { expiresIn: '4h' });
        return res.json({ token });
    }
    res.status(401).json({ error: 'Invalid administrator password' });
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Failed to authenticate token' });
        req.user = decoded;
        next();
    });
};

// Middleware for Admin Only access
const adminOnly = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Admin token required' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err || !decoded.isAdmin) {
            return res.status(403).json({ error: 'Access denied: Administrator privileges required' });
        }
        req.user = decoded;
        next();
    });
};

// GET CURRENT ELECTION STATE
router.get('/election/state', async (req, res) => {
    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });
        const state = await contract.state();
        res.json({ state: Number(state) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch election state' });
    }
});

// GET CANDIDATES FROM BLOCKCHAIN
router.get('/election/candidates', async (req, res) => {
    try {
        if (!contract) return res.status(500).json({ error: 'Blockchain not initialized' });
        const candidates = await contract.getCandidates();
        const formattedCandidates = candidates.map(c => ({
            id: c.id.toString(),
            name: c.name,
            voteCount: c.voteCount.toString()
        }));
        res.json(formattedCandidates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch candidates' });
    }
});

// ADD CANDIDATE (ADMIN ONLY)
router.post('/election/candidates', adminOnly, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Candidate name is required' });

    try {
        const tx = await contract.addCandidate(name);
        await tx.wait();
        res.json({ message: 'Candidate added successfully', txHash: tx.hash });
    } catch (error) {
        console.error("Failed to add candidate:", error);
        res.status(500).json({ error: 'Failed to add candidate', details: error.message });
    }
});

// START ELECTION (ADMIN ONLY)
router.post('/election/start', adminOnly, async (req, res) => {
    try {
        const tx = await contract.startElection();
        await tx.wait();
        res.json({ message: 'Election started successfully', txHash: tx.hash });
    } catch (error) {
        console.error("Failed to start election:", error);
        res.status(500).json({ error: 'Failed to start election', details: error.message });
    }
});

// END ELECTION (ADMIN ONLY)
router.post('/election/end', adminOnly, async (req, res) => {
    try {
        const tx = await contract.endElection();
        await tx.wait();
        res.json({ message: 'Election ended successfully', txHash: tx.hash });
    } catch (error) {
        res.status(500).json({ error: 'Failed to end election' });
    }
});

// REGISTER VOTER (ADMIN ONLY)
router.post('/election/voters', adminOnly, async (req, res) => {
    const { aadhar_number } = req.body;
    if (!aadhar_number) return res.status(400).json({ error: 'Aadhar number is required' });

    const hashedAadhar = crypto.createHash('sha256').update(aadhar_number).digest('hex');

    db.run(`INSERT OR IGNORE INTO voters (hashed_aadhar, has_voted) VALUES (?, ?)`, [hashedAadhar, false], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Voter registered successfully', hashedAadhar });
    });
});

// CAST VOTE (RELAYER - VOTER ONLY)
router.post('/election/vote', verifyToken, async (req, res) => {
    const { candidateId } = req.body;
    const hashedAadhar = req.user.hashedAadhar;

    if (req.user.isAdmin) {
        return res.status(403).json({ error: 'Administrators are not permitted to cast votes.' });
    }

    if (candidateId === undefined) return res.status(400).json({ error: 'Candidate ID is required' });

    db.get(`SELECT has_voted FROM voters WHERE hashed_aadhar = ?`, [hashedAadhar], async (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (row && row.has_voted) return res.status(403).json({ error: 'User has already voted' });

        try {
            db.run(`UPDATE voters SET has_voted = ? WHERE hashed_aadhar = ?`, [true, hashedAadhar], async function(err) {
                if (err) return res.status(500).json({ error: 'Failed to record vote' });
                try {
                    const tx = await contract.adminVote(candidateId);
                    await tx.wait();
                    res.json({ message: 'Vote successfully cast on blockchain', txHash: tx.hash });
                } catch (blockchainErr) {
                    db.run(`DELETE FROM voters WHERE hashed_aadhar = ?`, [hashedAadhar]);
                    res.status(500).json({ error: 'Blockchain transaction failed' });
                }
            });
        } catch (error) {
            console.error("Internal server error during voting:", error);
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
});

// GET REGISTERED VOTERS (ADMIN ONLY)
router.get('/election/voters', adminOnly, async (req, res) => {
    db.all(`SELECT hashed_aadhar, has_voted FROM voters`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// GET AUDIT LOG (TRANSACTIONS - AUTHENTICATED)
router.get('/election/audit', verifyToken, async (req, res) => {
    try {
        const filter = contract.filters.VoteCast();
        const events = await contract.queryFilter(filter);
        const auditLog = events.map(event => ({
            voterAddress: event.args.voter,
            candidateId: event.args.candidateId.toString(),
            timestamp: event.args.timestamp ? Number(event.args.timestamp) : null,
            transactionHash: event.transactionHash,
            blockNumber: Number(event.blockNumber)
        }));
        res.json(auditLog.reverse());
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

module.exports = router;
