# ADR-004: Event-Driven Asynchronous Indexing

## Context
Querying blockchain nodes via `eth_getLogs` or `queryFilter` synchronously during HTTP client requests degrades performance, increases RPC costs, and introduces single points of failure when nodes experience latency.

## Decision
We implemented a background asynchronous Event Indexer (`backend/indexer/indexer.js`) with deduplication and periodic reconciliation.

## Rationale
1. **Low Latency:** Client audit queries read pre-indexed records from indexed database tables in <5ms rather than waiting 500-1500ms for RPC network round-trips.
2. **Idempotency:** A unique composite constraint on `(tx_hash, log_index)` prevents duplicate event writes.
3. **Resilience:** The indexer tracks block progress and automatically recovers from disconnections or server restarts.

## Consequences
- A small indexing lag (~1-2 seconds) exists between on-chain confirmation and database availability.
