/**
 * @file indexer.js
 * @notice Production Event-Driven Indexing Engine
 * @dev Stateless block polling via eth_getLogs, deduplicating on (tx_hash, log_index) to sync off-chain database.
 */

const db = require('../database/db');

const STATE_NAMES = ['CREATED', 'REGISTRATION', 'OPEN', 'CLOSED', 'FINALIZED', 'ANNULLED'];

class EventIndexer {
    constructor() {
        this.contract = null;
        this.provider = null;
        this.isProcessing = false;
        this.pollingInterval = null;
    }

    /**
     * Starts the indexer with the initialized ethers Contract instance.
     */
    async start(contract, provider) {
        this.contract = contract;
        this.provider = provider;

        console.log('[Indexer] Starting Event Indexer on contract at', await contract.getAddress());

        // Process any past blocks since last recorded block
        await this.syncHistoricalEvents();

        // High-frequency polling (every 3 seconds) using stateless queryFilter (eth_getLogs)
        // This is resilient against filter expiration and RPC node restarts
        this.pollingInterval = setInterval(() => {
            this.syncHistoricalEvents().catch(err => {
                console.error('[Indexer] Reconciliation poll error:', err.message);
            });
        }, 3000);
    }

    /**
     * Queries past events from the contract and syncs to database.
     */
    async syncHistoricalEvents() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const currentBlock = await this.provider.getBlockNumber();
            
            // Find highest indexed block number in DB
            const res = await db.query('SELECT MAX(block_number) as max_block FROM blockchain_events');
            const fromBlock = (res.rows[0] && res.rows[0].max_block) ? Number(res.rows[0].max_block) + 1 : 0;

            if (fromBlock <= currentBlock) {
                const events = await this.contract.queryFilter('*', fromBlock, currentBlock);
                for (const event of events) {
                    await this.processEvent(event);
                }
            }
        } catch (err) {
            console.error('[Indexer] Sync error:', err.message);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Idempotently processes an event log.
     */
    async processEvent(event) {
        if (!event) return;

        const log = event.log || event;
        const eventName = (event.fragment && event.fragment.name) || log.eventName || event.name;
        const txHash = log.transactionHash;
        const logIndex = log.index !== undefined ? log.index : 0;
        const blockNumber = log.blockNumber;

        if (!blockNumber || !txHash || !eventName) {
            return;
        }

        // Deduplication check
        const check = await db.query(
            'SELECT id FROM blockchain_events WHERE tx_hash = $1 AND log_index = $2',
            [txHash, logIndex]
        );
        if (check.rows.length > 0) {
            return; // Already indexed
        }

        const args = event.args;
        let electionId = null;

        if (args && args.electionId !== undefined) {
            electionId = Number(args.electionId);
        }

        const contractAddress = await this.contract.getAddress();

        // 1. Process Domain Logic based on Event
        if (eventName === 'ElectionCreated') {
            const name = args.name;
            let desc = 'Standard decentralized ballot session';
            let parentId = null;
            try {
                const onChainEl = await this.contract.getElection(electionId);
                if (onChainEl.description) desc = onChainEl.description;
                if (Number(onChainEl.parentElectionId) > 0) parentId = Number(onChainEl.parentElectionId);
            } catch (_) {}

            await db.query(
                `INSERT OR IGNORE INTO elections (id, name, description, state, contract_address, creation_tx_hash, parent_election_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [electionId, name, desc, 'CREATED', contractAddress, txHash, parentId]
            );
        } else if (eventName === 'CandidateAdded') {
            const candidateId = Number(args.candidateId);
            const candidateName = args.name;
            await db.query(
                `INSERT OR IGNORE INTO candidates (election_id, candidate_index, name)
                 VALUES ($1, $2, $3)`,
                [electionId, candidateId, candidateName]
            );
        } else if (eventName === 'ElectionStateChanged') {
            const newStateIdx = Number(args.newState);
            const newStateName = STATE_NAMES[newStateIdx] || 'CREATED';
            
            let timeCol = null;
            if (newStateName === 'OPEN') timeCol = 'opened_at = CURRENT_TIMESTAMP';
            if (newStateName === 'CLOSED') timeCol = 'closed_at = CURRENT_TIMESTAMP';
            if (newStateName === 'FINALIZED') timeCol = 'finalized_at = CURRENT_TIMESTAMP';
            if (newStateName === 'ANNULLED') timeCol = 'closed_at = CURRENT_TIMESTAMP';

            const updateSql = timeCol 
                ? `UPDATE elections SET state = $1, ${timeCol} WHERE id = $2`
                : `UPDATE elections SET state = $1 WHERE id = $2`;

            await db.query(updateSql, [newStateName, electionId]);
        } else if (eventName === 'ElectionAnnulled') {
            const reason = args.reason;
            const authority = args.authority;
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
                    authority,
                    'ELECTION_ANNULLED_ON_CHAIN',
                    JSON.stringify({ electionId, reason, txHash, blockNumber })
                ]
            );
        } else if (eventName === 'VoteCast') {
            const nullifier = args.nullifier;
            // Update voter authorization status if matched
            await db.query(
                `UPDATE voter_authorizations 
                 SET has_voted = 1, voted_at = CURRENT_TIMESTAMP 
                 WHERE election_id = $1 AND nullifier_hash = $2`,
                [electionId, nullifier]
            );

            // Update transaction status to CONFIRMED
            await db.query(
                `UPDATE transactions 
                 SET status = 'CONFIRMED', block_number = $1, confirmed_at = CURRENT_TIMESTAMP 
                 WHERE tx_hash = $2`,
                [blockNumber, txHash]
            );

            // Log to audit trail
            await db.query(
                `INSERT INTO audit_logs (actor, action, details_json)
                 VALUES ($1, $2, $3)`,
                [
                    args.submitter,
                    'VOTE_CONFIRMED_ON_CHAIN',
                    JSON.stringify({ electionId, candidateId: Number(args.candidateId), nullifier, txHash, blockNumber })
                ]
            );
        }

        // 2. Insert into blockchain_events index
        let payload = {};
        if (args) {
            try {
                const rawObj = args.toObject ? args.toObject() : args;
                for (const [k, v] of Object.entries(rawObj)) {
                    if (isNaN(k)) {
                        payload[k] = typeof v === 'bigint' ? v.toString() : v;
                    }
                }
            } catch (_) {
                if (event.fragment && event.fragment.inputs) {
                    event.fragment.inputs.forEach((input, idx) => {
                        const val = args[idx];
                        payload[input.name] = typeof val === 'bigint' ? val.toString() : val;
                    });
                }
            }
        }

        await db.query(
            `INSERT INTO blockchain_events (event_name, election_id, block_number, tx_hash, log_index, payload_json)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [eventName, electionId, blockNumber, txHash, logIndex, JSON.stringify(payload)]
        );

        console.log(`[Indexer] Indexed event ${eventName} (Election #${electionId}, Block #${blockNumber})`);
    }

    stop() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        console.log('[Indexer] Stopped.');
    }
}

const indexer = new EventIndexer();
module.exports = indexer;
