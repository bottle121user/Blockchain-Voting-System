# ADR-003: On-Chain vs. Off-Chain Data Boundary

## Context
Deciding what data belongs on a public blockchain versus off-chain in a relational database is the most critical architectural decision in Web3 engineering.

## Decision
We established a strict separation of concerns:
- **On-Chain:** Election state machine, candidate IDs, vote tallies, nullifier spent statuses, and security events.
- **Off-Chain:** User identity credentials (Aadhaar hashes), candidate bios, election descriptions, and transaction telemetry.

## Rationale
1. **Privacy:** Real-world identities must never be stored on a public blockchain ledger.
2. **Cost & Scalability:** Storing arbitrary strings or metadata on-chain causes unnecessary gas bloat.
3. **Immutability Where It Matters:** The election outcome and vote tally are permanently sealed on the decentralized ledger.

## Consequences
- The backend serves as an authorized relayer and indexer connecting both domains.
