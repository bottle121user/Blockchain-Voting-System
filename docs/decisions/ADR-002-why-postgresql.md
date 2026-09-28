# ADR-002: Why PostgreSQL for Relational Off-Chain State?

## Context
A pure on-chain application suffers from high gas costs, slow query times, and inability to perform complex searches or maintain private user data. We needed a robust off-chain database to manage relational metadata and index blockchain events.

## Decision
We adopted PostgreSQL as the production database engine, supported by a unified SQL Data Access Layer that supports SQLite for zero-setup local development.

## Rationale
1. **Relational Integrity & Foreign Keys:** Strict foreign key constraints (`ON DELETE CASCADE`) guarantee that candidate and voter data remain consistent with election sessions.
2. **ACID Transactions:** Ensures atomic state changes during administrative setup and user authorization.
3. **High-Performance Indexing:** B-tree indexes on `election_id`, `tx_hash`, and `nullifier_hash` allow sub-5ms query response times.

## Consequences
- Requires synchronizing on-chain and off-chain states. Solved via the Event Indexer.
