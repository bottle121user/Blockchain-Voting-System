-- ==============================================================================
-- ChainVote — Production Relational Database Schema (PostgreSQL DDL)
-- ==============================================================================

-- Drop tables in reverse dependency order if resetting
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS blockchain_events CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS voter_authorizations CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS elections CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table (Role-Based Access Control)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('ADMIN', 'ORGANIZER', 'AUDITOR', 'VOTER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Elections Table (Off-Chain Mirror of On-Chain State Machine)
CREATE TABLE elections (
    id INTEGER PRIMARY KEY, -- Corresponds directly to on-chain electionId
    name VARCHAR(255) NOT NULL,
    description TEXT,
    state VARCHAR(30) NOT NULL DEFAULT 'CREATED' CHECK (state IN ('CREATED', 'REGISTRATION', 'OPEN', 'CLOSED', 'FINALIZED', 'ANNULLED')),
    contract_address VARCHAR(42) NOT NULL,
    creation_tx_hash VARCHAR(66),
    parent_election_id INTEGER REFERENCES elections(id),
    annulment_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    finalized_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_elections_state ON elections(state);

-- 3. Candidates Table
CREATE TABLE candidates (
    id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    candidate_index INTEGER NOT NULL, -- On-chain 0-indexed candidate ID
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_election_candidate UNIQUE (election_id, candidate_index)
);

CREATE INDEX idx_candidates_election ON candidates(election_id);

-- 4. Voter Authorizations (Pseudonymous Nullifiers & Whitelisting)
CREATE TABLE voter_authorizations (
    id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    voter_identifier_hash VARCHAR(66) NOT NULL, -- SHA-256 of voter credential
    nullifier_hash VARCHAR(66) NOT NULL,       -- Keccak256 commitment for on-chain spend check
    has_voted BOOLEAN NOT NULL DEFAULT FALSE,
    voted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_election_voter UNIQUE (election_id, voter_identifier_hash),
    CONSTRAINT uq_election_nullifier UNIQUE (election_id, nullifier_hash)
);

CREATE INDEX idx_voter_auth_lookup ON voter_authorizations(election_id, voter_identifier_hash);
CREATE INDEX idx_voter_auth_nullifier ON voter_authorizations(nullifier_hash);

-- 5. Transactions Table (Full Lifecycle Tracking)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    election_id INTEGER REFERENCES elections(id) ON DELETE SET NULL,
    tx_hash VARCHAR(66) UNIQUE,
    tx_type VARCHAR(50) NOT NULL CHECK (tx_type IN ('CREATE_ELECTION', 'ADD_CANDIDATE', 'OPEN_REGISTRATION', 'OPEN_ELECTION', 'CAST_VOTE', 'CLOSE_ELECTION', 'FINALIZE_ELECTION')),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED')),
    block_number BIGINT,
    gas_used BIGINT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_hash ON transactions(tx_hash);

-- 6. Blockchain Events (Idempotent Event Log Index)
CREATE TABLE blockchain_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    election_id INTEGER,
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INTEGER NOT NULL,
    payload_json JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_event_tx_log UNIQUE (tx_hash, log_index)
);

CREATE INDEX idx_blockchain_events_election ON blockchain_events(election_id);
CREATE INDEX idx_blockchain_events_block ON blockchain_events(block_number);

-- 7. Audit Logs Table (Operational & Security Tracing)
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    actor VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details_json JSONB NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
