# ChainVote — Comprehensive Architecture & Security Audit

**Date:** September 2026  
**Auditor:** Lead Systems & Blockchain Engineering  
**Project:** ChainVote (Decentralized/Hybrid Blockchain Voting System)  
**Repository:** `z:\prosss\blockchain voting system`

---

## 1. Executive Summary

ChainVote is currently a prototype hybrid voting platform combining a Next.js frontend, an Express.js backend, a local SQLite database, and an Ethereum smart contract (`Voting.sol`) deployed to a local Hardhat test network. 

While the system possesses an attractive and responsive user interface with functional end-to-end routing, an in-depth code audit reveals significant architectural, cryptographic, and security discrepancies between what the UI claims and what the codebase actually implements. 

The purpose of this audit is to baseline the existing architecture honestly, document vulnerabilities and technical debt, and establish a rigorous, production-grade engineering upgrade roadmap.

---

## 2. Current Architecture Overview

```text
[Browser / Client (Next.js)]
   │
   ├── (HTTP / JSON + Bearer JWT)
   ▼
[Express.js Relayer Server (Port 5000)]
   │
   ├── (Raw SQL via sqlite3) ──► [SQLite: database.sqlite (single table: voters)]
   │
   └── (ethers.js v6 JsonRpcProvider + Single Admin Wallet)
         ▼
[Hardhat Local EVM Node (Port 8546)] ──► [Voting.sol Contract]
```

### Component Breakdown
1. **Frontend (`frontend/`):**
   - Next.js 14.2 (App Router), React 18, Tailwind CSS, Lucide icons, Axios.
   - Pages: Landing (`/`), Voter Login (`/login`), Voter Dashboard (`/dashboard`), Admin Login (`/admin/login`), Admin Dashboard (`/admin`), Public Results (`/results`).
   - State stored in browser `localStorage` (JWT tokens).
   - **Wallet connection:** 0% implemented. No Web3 provider (`window.ethereum`, MetaMask, Wagmi, Viem). All interactions occur via REST API calls.

2. **Backend Relayer (`backend/server/`):**
   - Node.js + Express.js.
   - Single route file `routes.js` handling authentication, election lifecycle, and voting.
   - Database: Local SQLite file (`database.sqlite`) with a single table:
     ```sql
     CREATE TABLE IF NOT EXISTS voters (
         hashed_aadhar TEXT PRIMARY KEY,
         has_voted BOOLEAN NOT NULL
     );
     ```
   - Blockchain relayer: Single custodial Ethereum wallet (`ADMIN_PRIVATE_KEY` `0x59c699...`) executing `adminVote()` on behalf of all voters.

3. **Smart Contract (`backend/contracts/Voting.sol`):**
   - Solidity `^0.8.20`. Single election lifecycle per contract deployment (`NotStarted`, `Ongoing`, `Ended`).
   - Functions: `addCandidate()`, `registerVoter()`, `startElection()`, `endElection()`, `vote()`, `adminVote()`, `getCandidates()`.

4. **Testing Suite (`backend/test/Voting.js`):**
   - Basic Hardhat Chai unit tests covering `Voting.sol` functions (deployment, candidate management, state transitions, direct voting, admin voting).
   - No backend integration tests, no API validation tests, no database integrity tests.

---

## 3. Existing Strengths

1. **Clean UI Aesthetic & Visual Polish:** Polished dark-mode theme, glassmorphic containers, clear status badges, and responsive layouts across mobile and desktop.
2. **Deterministic Smart Contract State Machine:** Contract properly enforces `inState` modifiers preventing candidates from being added after launch or votes being cast after election closure.
3. **Local Tooling Baseline:** Working Hardhat environment with functional deployment scripts and RPC communication.
4. **Receipt Generation:** Client generates and downloads a digital text ballot receipt containing transaction timestamps and cryptographic hashes.

---

## 4. Technical Weaknesses & Architectural Flaws

### 4.1. Centralized Custodial Relayer without Voter Signatures
- In the current `/election/vote` endpoint, the voter simply sends `{ candidateId: 0 }` with an HTTP Bearer JWT.
- The backend server's admin wallet executes `contract.adminVote(candidateId)`.
- **Flaw:** The voter signs nothing. The backend relayer has complete unilateral power to cast any vote for any candidate, censor voters, or fabricate votes without cryptographic accountability. The blockchain only records that the admin wallet called `adminVote`.

### 4.2. Relayer Nonce Collisions & Lack of Transaction Queue
- When multiple voters vote concurrently, the relayer wallet attempts to send transactions with identical or unsynchronized nonces.
- Result: Transactions reject with `NONCE_EXPIRED` or replacement transaction underpriced errors, causing vote loss.

### 4.3. Single Global Election Limit
- `Voting.sol` only supports one election for the lifetime of the deployed contract.
- To run a new election, the contract must be re-deployed, all addresses updated in `.env`, and backend restarted.
- There is no `electionId` parameter, preventing multi-election management or historical comparisons.

### 4.4. Inadequate Database Architecture
- Using an unindexed SQLite file with a single table (`voters`).
- No normalization: candidates, elections, transactions, audit logs, and administrators are completely absent from the database schema.
- Data rollback bug in `routes.js`:
  ```javascript
  catch (blockchainErr) {
      db.run(`DELETE FROM voters WHERE hashed_aadhar = ?`, [hashedAadhar]);
  }
  ```
  If a blockchain transaction fails, the voter record is **completely deleted** instead of resetting `has_voted = false`.

### 4.5. Inefficient & Fragile Audit Log Fetching
- `/election/audit` queries the RPC node synchronously via `contract.queryFilter(filter)` on every single client request.
- Under production load or over large block ranges, this causes RPC timeouts, rate-limiting, and severe UI latency.
- There is no asynchronous event listener or indexing layer storing events in a database.

---

## 5. Security Concerns & Vulnerabilities

| Vulnerability | Severity | Description |
| :--- | :--- | :--- |
| **Plaintext Admin Password** | **High** | Admin login compares cleartext `password === ADMIN_PASSWORD` (`admin123`) from `.env`. No bcrypt/argon2 hashing, no rate limiting, vulnerable to brute-force. |
| **Cleartext On-Chain Voting** | **High** | In the direct `vote()` function, `voters[msg.sender].votedCandidateId = _candidateId` stores exactly who voted for whom in public EVM storage, destroying voter privacy. |
| **Missing Input Validation** | **Medium** | No request validation schemas (Zod/Joi). Unsanitized body inputs passed directly to queries and contracts. |
| **No Nonce / Replay Protection** | **Medium** | JWT token replay allows anyone with the token to submit votes if the database query is raced. |
| **Hardcoded JWT Secret** | **Medium** | Fallback to hardcoded string `'supersecretkey_change_in_production'` in code. |

---

## 6. Reality Check: Implemented vs. Fabricated Claims

To ensure engineering integrity and portfolio credibility, all fabricated claims must be identified and eliminated or replaced with genuine implementations:

| Feature Claimed in UI | Reality in Codebase | Remediation Required |
| :--- | :--- | :--- |
| **"Zero-Knowledge Proofs"** (`page.js`) | **0% implemented.** No ZK circuits, no SnarkJS, no prover/verifier. | **Remove claim immediately.** Document ZK as a planned future roadmap in `SECURITY.md`. |
| **"Aadhaar Secured Protocol"** (`login/page.js`) | **Mocked.** Hardcoded check `otp === '123456'` and `sha256(aadhar)`. No UIDAI or Gov API integration. | Rename to **"National ID Demo Protocol"** and document mock status transparently. |
| **"Verified Blockchain Hash"** (`admin/page.js:208`) | **Fabricated.** Evaluates `0x7a...${Math.random().toString(36)}`. | **Delete fake string generator.** Replace with actual on-chain transaction hash from event logs. |
| **"Total Recovery Completion: 100%"** (`dashboard/page.js:181`) | **Hardcoded cosmetic string.** | Remove or bind to genuine database synchronization metrics. |
| **"0x-BLOCK-CERT-FINAL-..."** (`results/page.js:88`) | **Hardcoded string concatenation.** | Replace with true cryptographic block hash or merkle root verification. |
| **"100% Anonymous Voting"** | **False.** Cleartext candidate IDs or single-relayer centralization. | Document exact threat model: Pseudonymous voter tokens with relayer unlinkability. |

---

## 7. Recommended Upgrade Path

To meet the high standards of a senior software engineering portfolio, the system should follow a structured 5-phase refactoring:

### Phase 1: Smart Contract Modernization
- Multi-election support with an explicit state machine: `CREATED -> REGISTRATION -> OPEN -> CLOSED -> FINALIZED`.
- OpenZeppelin `AccessControl` / `Ownable2Step`.
- Voter commitment / nullifier mechanism preventing double voting on-chain without exposing the voter's real-world identity on-chain.
- Comprehensive Hardhat test suite covering state transitions and boundary conditions.

### Phase 2: PostgreSQL Relational Data Layer
- Transition from SQLite to PostgreSQL with a normalized schema (`elections`, `candidates`, `voters`, `transactions`, `blockchain_events`, `audit_logs`).
- Strong foreign keys, constraints, and timestamps.
- Repository pattern with clean data-access abstractions.

### Phase 3: Event Indexer & Transaction Lifecycle
- Background event listener connecting to EVM RPC via WebSocket / Polling.
- Idempotent event processing with block tracking and deduplication (`tx_hash` + `log_index`).
- Transaction state tracker: `PENDING -> SUBMITTED -> CONFIRMED -> FAILED`.

### Phase 4: Production Backend API & Security
- Express router with input validation (Zod), rate limiting (`express-rate-limit`), secure password hashing (`bcrypt`), and structured error handling.
- REST endpoints for multi-election lifecycle (`/api/elections`, `/api/elections/:id/vote`, `/api/elections/:id/results`).
- Cryptographic verification of vote intents.

### Phase 5: Honest, Transparent Frontend & Technical Documentation
- Connect Web3 wallet (MetaMask / EIP-1193) or transparent Meta-Transaction Relayer with client-side signature.
- Remove all fake random strings and ZK marketing claims.
- Create full engineering documentation: `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `THREAT_MODEL.md`, `API.md`, `DATABASE.md`, `BENCHMARKS.md`, and Architectural Decision Records (`docs/decisions/`).
