const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('../database/db');
const { contract, provider, wallet } = require('./blockchain');
const nonceManager = require('../services/nonceManager');
const indexer = require('../indexer/indexer');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// API Routes
app.use('/api', apiRoutes);

// Health & Telemetry Endpoint
app.get('/health', async (req, res) => {
    try {
        const blockNumber = provider ? await provider.getBlockNumber() : null;
        res.json({
            status: 'HEALTHY',
            service: 'ChainVote Backend API & Relayer',
            timestamp: new Date().toISOString(),
            blockchain: {
                connected: !!contract,
                latestBlock: blockNumber,
                contractAddress: contract ? await contract.getAddress() : null
            },
            database: {
                engine: db.isPostgres ? 'PostgreSQL' : 'SQLite Relational'
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'DEGRADED', error: err.message });
    }
});

// Graceful Bootstrap Sequence
async function startServer() {
    try {
        // 1. Initialize Relational Database Schema
        await db.initializeDatabase();

        // 2. Initialize Blockchain Relayer & Nonce Queue
        if (wallet) {
            await nonceManager.init(wallet);
        } else {
            console.warn('[Server] Wallet not configured; relayer queue inactive.');
        }

        // 3. Initialize Event-Driven Indexer
        if (contract && provider) {
            await indexer.start(contract, provider);
        }

        // 4. Ensure at least one default Election session exists on startup
        if (contract && wallet) {
            try {
                const count = await contract.electionCounter();
                if (Number(count) === 0) {
                    console.log('[Server] No elections found on-chain. Creating Genesis Election session...');
                    const tx = await nonceManager.enqueue(async (nonce) => {
                        return await contract.createElection(
                            "General Election 2026",
                            "Official Decentralized Presidential Ballot",
                            { nonce }
                        );
                    });
                    await tx.wait();
                    console.log('[Server] Genesis Election created on-chain at Tx:', tx.hash);

                    // Add default candidates
                    const txA = await nonceManager.enqueue(async (nonce) => {
                        return await contract.addCandidate(1, "Candidate Alpha", { nonce });
                    });
                    await txA.wait();

                    const txB = await nonceManager.enqueue(async (nonce) => {
                        return await contract.addCandidate(1, "Candidate Beta", { nonce });
                    });
                    await txB.wait();
                    console.log('[Server] Genesis Candidates (Alpha & Beta) registered.');
                }
            } catch (initErr) {
                console.warn('[Server] Genesis election check notice:', initErr.message);
            }
        }

        // 5. Start Listening
        app.listen(PORT, () => {
            console.log(`[Server] ChainVote Relayer Service listening on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('[Server] Critical startup failure:', error);
        process.exit(1);
    }
}

startServer();
