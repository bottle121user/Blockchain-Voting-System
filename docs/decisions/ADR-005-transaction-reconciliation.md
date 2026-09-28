# ADR-005: Serialized Transaction Queue & Nonce Reconciliation

## Context
When a single relayer wallet broadcasts Ethereum transactions for concurrent voter requests, using the standard ethers provider nonces causes transaction replacements, underpriced errors, or `NONCE_EXPIRED` reverts.

## Decision
We implemented a FIFO Promise Queue and Nonce Manager (`backend/services/nonceManager.js`).

## Rationale
1. **Strict Ordering:** Transactions are serialized in memory with monotonically increasing nonces.
2. **Auto-Reconciliation:** If any transaction fails on-chain, the manager queries the node's `pending` nonce to resynchronize the counter before executing subsequent queue steps.

## Consequences
- Relayed transactions are processed sequentially per wallet address.
