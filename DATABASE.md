# ChainVote — Database Architecture & Data Dictionary

## 1. Storage Engine Architecture
ChainVote supports two interchangeable relational engines via a unified Data Access Layer (`backend/database/db.js`):
1. **Production Engine:** PostgreSQL via `pg.Pool` (triggered whenever `DATABASE_URL` is set).
2. **Local Engine:** SQLite (`sqlite3`) with `PRAGMA foreign_keys = ON` and parameterized `$1, $2` query normalization.

---

## 2. Entity Relationship Diagram (Logical)

```text
    ┌───────────────┐
    │     users     │
    └───────────────┘
            
    ┌───────────────┐        1:N        ┌─────────────────┐
    │   elections   ├──────────────────►│   candidates    │
    └───────┬───────┘                   └─────────────────┘
            │
            │ 1:N
            ├──────────────────────────►┌─────────────────────────┐
            │                           │  voter_authorizations   │
            │                           └─────────────────────────┘
            │ 1:N
            ├──────────────────────────►┌─────────────────┐
            │                           │  transactions   │
            │                           └─────────────────┘
            │ 1:N
            └──────────────────────────►┌─────────────────────┐
                                        │  blockchain_events  │
                                        └─────────────────────┘
```

---

## 3. Data Dictionary

### Table: `elections`
* `id` (INTEGER, PK): Direct match to on-chain `electionId`.
* `name` (VARCHAR): Election title.
* `description` (TEXT): Detailed background and context.
* `state` (VARCHAR): Current lifecycle state (`CREATED`, `REGISTRATION`, `OPEN`, `CLOSED`, `FINALIZED`).
* `contract_address` (VARCHAR): Address of deployed smart contract.
* `creation_tx_hash` (VARCHAR): Hash of on-chain creation transaction.

### Table: `candidates`
* `id` (SERIAL, PK): Unique record identifier.
* `election_id` (INTEGER, FK): Reference to `elections(id)`.
* `candidate_index` (INTEGER): On-chain 0-indexed candidate ID.
* `name` (VARCHAR): Candidate name.

### Table: `voter_authorizations`
* `id` (SERIAL, PK): Unique record identifier.
* `election_id` (INTEGER, FK): Reference to `elections(id)`.
* `voter_identifier_hash` (VARCHAR): SHA-256 of voter credential (Aadhaar or student ID).
* `nullifier_hash` (VARCHAR, UNIQUE): Cryptographic nullifier commitment.
* `has_voted` (BOOLEAN): Status flag updated upon confirmed block inclusion.

### Table: `blockchain_events`
* `id` (SERIAL, PK): Unique record identifier.
* `event_name` (VARCHAR): Event signature (e.g., `VoteCast`, `ElectionStateChanged`).
* `block_number` (BIGINT): Height of confirmed block.
* `tx_hash` (VARCHAR): Transaction hash.
* `log_index` (INTEGER): Index of log within the block.
* `payload_json` (JSONB / TEXT): Decoded event parameters.
* **Constraint:** `UNIQUE (tx_hash, log_index)` guarantees idempotent processing.
