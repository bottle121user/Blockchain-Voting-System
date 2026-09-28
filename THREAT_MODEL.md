# ChainVote — Comprehensive Threat Model (STRIDE)

This document outlines the threat analysis for ChainVote using the STRIDE methodology.

---

## 1. Threat Matrix & Mitigations

| Category | Threat Description | Attack Vector | Mitigation in ChainVote |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Unauthorized user assumes Admin role. | Brute-force password guessing on `/api/auth/admin-login`. | Bcrypt password hashing (cost 12), IP-based rate limiting (`authLimiter`), and cryptographic JWT signatures. |
| **Tampering** | Modifying election vote counts or candidate lists. | Database SQL injection or backend memory manipulation. | Tallies are calculated on-chain in EVM storage; candidates cannot be added once election state is `OPEN`. |
| **Repudiation** | Voter claims they never voted or administrator denies election closure. | Disavowing administrative actions or voter submissions. | Every state transition and vote emits an indexed blockchain event containing block number, timestamp, and tx hash. |
| **Information Disclosure** | Discovering which voter voted for which candidate. | Inspecting public blockchain ledger or API responses. | Ballot options are submitted via pseudonymous nullifiers; no link between voter identification and candidate ID exists on-chain. |
| **Denial of Service** | Flooding relayer with concurrent voting requests to cause nonce collisions. | Parallel HTTP requests to `/api/elections/:id/vote`. | Serialized `NonceManager` promise queue, express rate limiting, and database-level pre-spend validation. |
| **Elevation of Privilege** | Normal voter calls administrative methods on-chain or via API. | Invoking `addCandidate()` or `openElection()`. | OpenZeppelin `AccessControl` (`ELECTION_ORGANIZER_ROLE` / `DEFAULT_ADMIN_ROLE`) and Express `adminOnly` middleware. |

---

## 2. Blockchain-Specific Threats & Mitigations

### 2.1. Double Voting
- **Risk:** Voter submits ballot multiple times to influence outcome.
- **Mitigation:** Two-tier protection:
  1. Off-chain database unique constraint on `(election_id, nullifier_hash)`.
  2. On-chain EVM storage constraint `require(!hasVotedNullifier[electionId][nullifier])` in `VotingSystem.sol`.

### 2.2. Relayer Nonce Desynchronization
- **Risk:** Node restart or concurrent requests cause `NONCE_EXPIRED` transaction failure.
- **Mitigation:** The `NonceManager` auto-recovers by querying the EVM node for `getNonce('pending')` whenever a transaction rejection is caught.

### 2.3. RPC Outages & Network Partitions
- **Risk:** Blockchain node goes offline temporarily.
- **Mitigation:** Backend operates with a resilient relational read-cache. The Event Indexer performs periodic reconciliation polling with exponential backoff.
