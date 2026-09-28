# ChainVote — System Architecture Specification

## 1. System Topology

ChainVote implements a hybrid decentralized architecture designed for high throughput, verifiable integrity, and operational resilience.

```text
┌────────────────────────────────────────────────────────┐
│                   Next.js Web Client                   │
│   • Multi-Election Voter Dashboard & Admin Console     │
│   • Client-Side Nullifier Computation (SHA-256)        │
│   • Transparent Transaction Tracker                    │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST (JSON + JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│            Express.js API & Relayer Service            │
│   • Request Validation (Zod Schemas)                   │
│   • Rate Limiting & Auth (Bcrypt + JWT)                │
│   • Serialized Nonce Queue (NonceManager)              │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       SQL Pool │                        │ JSON-RPC (ethers.js v6)
                ▼                        ▼
┌───────────────────────────┐  ┌─────────────────────────┐
│    Relational Database    │  │    Ethereum EVM Node    │
│  • PostgreSQL / SQLite    │  │  • Hardhat / Testnet    │
│  • Normalized Schema      │  │  • VotingSystem.sol     │
│  • Indexed Events & Audit │  │  • AccessControl (Roles)│
└───────────────▲───────────┘  └─────────┬───────────────┘
                │                        │
                │ Idempotent Event Sync  │ Contract Events
                └────────────────────────┘
```

---

## 2. On-Chain vs. Off-Chain Data Boundary

| Component | Storage Location | Rationale |
| :--- | :--- | :--- |
| **Election State Machine** | **On-Chain (`VotingSystem.sol`)** | Guarantees that elections cannot be manipulated or prematurely opened/closed off-chain. |
| **Candidate Tallies** | **On-Chain (`VotingSystem.sol`)** | Publicly auditable and mathematically immutable; verifiable by any independent blockchain node. |
| **Nullifier Hash Commitments** | **On-Chain (`VotingSystem.sol`)** | Enforces single-vote invariant per election without recording the voter's identity on-chain. |
| **Election Metadata** | **Off-Chain (PostgreSQL)** | Rich text descriptions, organization banners, and candidate profiles too costly for gas storage. |
| **Voter Credentials** | **Off-Chain (PostgreSQL)** | Private hashed identifiers (SHA-256) kept off public ledgers for voter privacy. |
| **Transaction States** | **Off-Chain (PostgreSQL)** | Real-time tracking of `SUBMITTED`, `CONFIRMED`, `FAILED` states and gas telemetry. |
| **Indexed Event History** | **Off-Chain (PostgreSQL)** | Enables sub-10ms queries for audit dashboards without overwhelming blockchain RPC nodes. |

---

## 3. Core Subsystems

### 3.1. Smart Contract State Machine (`VotingSystem.sol`)
An explicit finite state machine:
```text
CREATED  ──►  REGISTRATION  ──►  OPEN  ──►  CLOSED  ──►  FINALIZED
```
- **Rules:**
  - Candidates can only be registered before an election opens.
  - At least 2 candidates must exist before transitioning to `OPEN`.
  - Votes can only be accepted when state is strictly `OPEN`.
  - Closing an election freezes tallies permanently.
  - Finalizing an election proclaims results officially.

### 3.2. Serialized Nonce Queue (`nonceManager.js`)
Ethereum transactions sent from a single relayer wallet must have strictly sequential nonces. Under concurrent voting load, asynchronous requests would otherwise collide. The `NonceManager` executes tasks within a serial promise chain, automatically recovering and resynchronizing if any transaction fails.

### 3.3. Idempotent Event Indexer (`indexer.js`)
The indexer connects to the contract via WebSocket/polling and consumes all emitted events (`ElectionCreated`, `CandidateAdded`, `ElectionStateChanged`, `VoteCast`). It writes them into the `blockchain_events` table deduplicated on `(tx_hash, log_index)`. If the backend restarts, it checks the maximum indexed block and replays missed blocks seamlessly.
