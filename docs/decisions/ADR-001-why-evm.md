# ADR-001: Why Ethereum-Compatible (EVM) Architecture?

## Context
When building a verifiable voting system, an immutable ledger is needed to record election states and votes without reliance on a single centralized administrator. We evaluated several ledger paradigms: Bitcoin Script, Solana, Hyperledger Fabric, and EVM (Ethereum Virtual Machine).

## Decision
We chose the Ethereum-Compatible EVM standard implemented with Solidity 0.8.20 and OpenZeppelin contracts.

## Rationale
1. **Industry Standard & Mature Tooling:** Hardhat, ethers.js, OpenZeppelin, and Solidity provide the most mature security tooling, static analysis, and testing frameworks in the industry.
2. **Decentralized Verification:** Anyone with an RPC connection can audit contract storage and event logs directly without proprietary consortium credentials.
3. **Ecosystem Interoperability:** EVM bytecode can deploy transparently to Ethereum Mainnet, Polygon, Arbitrum, or local testnets without code modifications.

## Consequences
- Requires gas fee management. Addressed via the authorized Relayer pattern for gasless voter participation.
