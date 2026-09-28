const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let dbClient = null;
let isPostgres = false;

// Check if PostgreSQL DATABASE_URL is configured
const connectionString = process.env.DATABASE_URL;

if (connectionString && connectionString.startsWith('postgres')) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString });
    dbClient = {
        query: async (text, params) => {
            const res = await pool.query(text, params);
            return { rows: res.rows, rowCount: res.rowCount };
        }
    };
    isPostgres = true;
    console.log('[DB] Connected to PostgreSQL relational engine');
} else {
    // High-fidelity local SQLite relational engine with identical schema
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, '../server/chainvote.sqlite');
    const sqliteDb = new sqlite3.Database(dbPath);

    // Enforce foreign key constraints in SQLite
    sqliteDb.run("PRAGMA foreign_keys = ON;");

    dbClient = {
        query: (text, params = []) => {
            return new Promise((resolve, reject) => {
                // Normalize PostgreSQL $1, $2 placeholders to SQLite ?
                let normalizedText = text.replace(/\$(\d+)/g, '?');

                const trimmed = normalizedText.trim().toUpperCase();
                if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
                    sqliteDb.all(normalizedText, params, (err, rows) => {
                        if (err) return reject(err);
                        resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
                    });
                } else {
                    sqliteDb.run(normalizedText, params, function (err) {
                        if (err) return reject(err);
                        resolve({ 
                            rows: [], 
                            rowCount: this.changes, 
                            lastID: this.lastID 
                        });
                    });
                }
            });
        }
    };
    console.log('[DB] Connected to local relational SQL engine at', dbPath);
}

/**
 * Initializes the database schema and seeds default admin if empty.
 */
async function initializeDatabase() {
    console.log('[DB] Synchronizing relational schema...');

    // Run table definitions
    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('ADMIN', 'ORGANIZER', 'AUDITOR', 'VOTER')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS elections (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            state TEXT NOT NULL DEFAULT 'CREATED' CHECK (state IN ('CREATED', 'REGISTRATION', 'OPEN', 'CLOSED', 'FINALIZED', 'ANNULLED')),
            contract_address TEXT NOT NULL,
            creation_tx_hash TEXT,
            parent_election_id INTEGER REFERENCES elections(id),
            annulment_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            opened_at DATETIME,
            closed_at DATETIME,
            finalized_at DATETIME
        );
    `);

    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
            candidate_index INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(election_id, candidate_index)
        );
    `);

    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS voter_authorizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
            voter_identifier_hash TEXT NOT NULL,
            nullifier_hash TEXT NOT NULL,
            has_voted BOOLEAN NOT NULL DEFAULT 0,
            voted_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(election_id, voter_identifier_hash),
            UNIQUE(election_id, nullifier_hash)
        );
    `);

    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            election_id INTEGER REFERENCES elections(id) ON DELETE SET NULL,
            tx_hash TEXT UNIQUE,
            tx_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED')),
            block_number INTEGER,
            gas_used INTEGER,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            confirmed_at DATETIME
        );
    `);

    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS blockchain_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_name TEXT NOT NULL,
            election_id INTEGER,
            block_number INTEGER NOT NULL,
            tx_hash TEXT NOT NULL,
            log_index INTEGER NOT NULL,
            payload_json TEXT NOT NULL,
            indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tx_hash, log_index)
        );
    `);

    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            details_json TEXT NOT NULL,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS candidate_nominations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
            voter_identifier_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            party_affiliation TEXT NOT NULL DEFAULT 'INDEPENDENT',
            manifesto TEXT NOT NULL,
            age INTEGER NOT NULL CHECK (age >= 18),
            seconder1_hash TEXT NOT NULL,
            seconder2_hash TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
            rejection_reason TEXT,
            candidate_index INTEGER,
            blockchain_tx_hash TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reviewed_at DATETIME,
            UNIQUE(election_id, voter_identifier_hash)
        );
    `);

    // Seed default admin user with secure bcrypt hash
    const adminCheck = await dbClient.query("SELECT id FROM users WHERE username = $1", ['admin']);
    if (adminCheck.rows.length === 0) {
        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash('admin123', salt);
        await dbClient.query(
            "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
            ['admin', hash, 'ADMIN']
        );
        console.log('[DB] Default admin user initialized with bcrypt (username: admin)');
    }

    console.log('[DB] Relational schema initialized successfully.');
}

module.exports = {
    query: (text, params) => dbClient.query(text, params),
    initializeDatabase,
    isPostgres
};
